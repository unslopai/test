import os
import sys

def register_plugin_directory():
    plugin_dir = os.environ.get("APP_PLUGIN_DIR", "./plugins")
    sys.path.insert(0, plugin_dir)

def load_reporting_plugin():
    register_plugin_directory()
    import reporting_plugin
    return reporting_plugin.build_report_engine()
