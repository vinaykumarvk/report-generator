import os
import sys

if any(arg.endswith("pytest") or arg.endswith("pytest.exe") or "pytest" in arg for arg in sys.argv):
    os.environ.setdefault("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
