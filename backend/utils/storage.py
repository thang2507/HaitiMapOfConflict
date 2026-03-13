import os


def file_version(path):
    if not path or not os.path.exists(path):
        return 'missing'
    stat = os.stat(path)
    return f"{stat.st_mtime_ns}-{stat.st_size}"
