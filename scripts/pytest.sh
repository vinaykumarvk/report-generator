#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="${VENV_DIR:-.venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [[ ! -d "${VENV_DIR}" ]]; then
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

VENV_PYTHON="${VENV_DIR}/bin/python"
if [[ ! -x "${VENV_PYTHON}" ]]; then
  echo "Virtualenv Python not found at ${VENV_PYTHON}" >&2
  exit 1
fi

if ! "${VENV_PYTHON}" -m pytest --version >/dev/null 2>&1; then
  "${VENV_PYTHON}" -m pip install --upgrade pip
  "${VENV_PYTHON}" -m pip install -r requirements.txt
fi

export PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
export PYTHONPATH="${PYTHONPATH:-}:src"
"${VENV_PYTHON}" -m pytest "$@"
