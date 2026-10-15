#!/usr/bin/env python3
"""Train an offline synthetic-evidence baseline from exported SPECTRA sessions.

This is a research utility, not an operational threat detector. Results describe
only the synthetic scenarios and training decisions contained in the input files.
"""
from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path
from typing import Any

FEATURES = [
    "radarConfidence",
    "visualConfidence",
    "rfConfidence",
    "motionConfidence",
    "trackQuality",
    "fusionConfidence",
    "estimatedRangeM",
    "trackUncertaintyM",
    "isActionable",
    "radarVisible",
    "visualVisible",
    "rfVisible",
]


def find_sessions(inputs: list[str]) -> list[Path]:
    paths: list[Path] = []
    for item in inputs:
        candidate = Path(item)
        if candidate.is_dir():
            paths.extend(candidate.rglob("spectra-session-*.json"))
            paths.extend(candidate.rglob("*.json"))
        elif candidate.is_file():
            paths.append(candidate)
        else:
            paths.extend(Path(p) for p in glob.glob(item, recursive=True) if Path(p).is_file())
    unique: dict[str, Path] = {str(p.resolve()): p for p in paths if p.suffix.lower() == ".json"}
    return sorted(unique.values())


def load_rows(files: list[Path]) -> tuple[list[list[float]], list[str], list[str]]:
    rows: list[list[float]] = []
    labels: list[str] = []
    groups: list[str] = []
    for path in files:
        try:
            payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"Skipping {path}: {exc}", file=sys.stderr)
            continue
        if payload.get("format") != "spectra-session":
            print(f"Skipping {path}: not a SPECTRA session export", file=sys.stderr)
            continue
        for decision in payload.get("decisions", []):
            features = decision.get("features")
            label = decision.get("expected")
            if not isinstance(features, dict) or not isinstance(label, str) or not label:
                continue
            values: list[float] = []
            usable = True
            for name in FEATURES:
                value = features.get(name)
                if value is None:
                    usable = False
                    break
                if isinstance(value, bool):
                    values.append(float(value))
                elif isinstance(value, (int, float)) and value == value:
                    values.append(float(value))
                else:
                    usable = False
                    break
            if usable:
                rows.append(values)
                labels.append(label)
                groups.append(str(path.resolve()))
    return rows, labels, groups


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sessions", nargs="+", help="JSON export file, directory, or glob (quote glob patterns)")
    parser.add_argument("--output", default="artifacts/spectra-baseline.joblib", help="Where to save the trained baseline")
    parser.add_argument("--test-size", type=float, default=0.25, help="Held-out fraction between 0.1 and 0.5")
    args = parser.parse_args()

    if not 0.1 <= args.test_size <= 0.5:
        parser.error("--test-size must be between 0.1 and 0.5")
    files = find_sessions(args.sessions)
    if not files:
        print("No session JSON files found. Export multiple sessions from the SPECTRA panel first.", file=sys.stderr)
        return 2
    rows, labels, groups = load_rows(files)
    if len(rows) < 20 or len(set(labels)) < 2:
        print(
            f"Need at least 20 usable labelled decisions from at least 2 classes; found {len(rows)} rows and {len(set(labels))} classes.",
            file=sys.stderr,
        )
        return 2
    class_counts = {label: labels.count(label) for label in sorted(set(labels))}
    if min(class_counts.values()) < 4:
        print("Collect more examples for each class before interpreting a baseline.", file=sys.stderr)
        return 2

    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import classification_report, confusion_matrix, f1_score
    from sklearn.model_selection import GroupShuffleSplit, train_test_split
    import joblib

    import numpy as np

    x = np.asarray(rows, dtype=float)
    y = np.asarray(labels, dtype=str)
    unique_groups = sorted(set(groups))
    if len(unique_groups) >= 2:
        splitter = GroupShuffleSplit(n_splits=1, test_size=args.test_size, random_state=42)
        train_idx, test_idx = next(splitter.split(x, y, groups=np.asarray(groups)))
        if len(set(y[train_idx])) < 2 or len(set(y[test_idx])) < 2:
            train_idx, test_idx = train_test_split(
                np.arange(len(y)), test_size=args.test_size, random_state=42, stratify=y
            )
            split_method = "stratified decision-level holdout (session split lacked class coverage)"
        else:
            split_method = "grouped holdout by exported session"
    else:
        train_idx, test_idx = train_test_split(
            np.arange(len(y)), test_size=args.test_size, random_state=42, stratify=y
        )
        split_method = "stratified decision-level holdout (one session file)"

    model = RandomForestClassifier(
        n_estimators=250,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x[train_idx], y[train_idx])
    predictions = model.predict(x[test_idx])
    labels_ordered = sorted(set(y))
    print("SPECTRA SYNTHETIC BASELINE — NOT OPERATIONALLY VALIDATED")
    print(f"Sessions: {len(files)} | usable decisions: {len(rows)} | train: {len(train_idx)} | test: {len(test_idx)}")
    print(f"Split: {split_method}")
    print(f"Classes: {class_counts}")
    print(f"Macro F1: {f1_score(y[test_idx], predictions, average='macro', zero_division=0):.3f}")
    print(classification_report(y[test_idx], predictions, labels=labels_ordered, zero_division=0))
    print("Confusion matrix (rows=true, columns=predicted; class order below):")
    print(labels_ordered)
    print(confusion_matrix(y[test_idx], predictions, labels=labels_ordered))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "model": model,
        "feature_names": FEATURES,
        "class_names": labels_ordered,
        "training_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "session_files": [str(path) for path in files],
        "split_method": split_method,
        "warning": "Synthetic training only. Not validated on real sensor data."
    }, output)
    print(f"Saved baseline artifact: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
