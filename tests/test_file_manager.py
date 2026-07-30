from backend import workspace_manager as wm
from backend import file_manager as fm


def test_write_and_read_text_file():
    ws = wm.create_workspace("FM")
    result = fm.write_file(ws['id'], 'markdown/note.md', "# Hello\n")
    assert result is not None
    assert result['path'] == 'markdown/note.md'
    assert result['size'] == len("# Hello\n")

    content = fm.read_file(ws['id'], 'markdown/note.md')
    assert content is not None
    assert content['content'] == "# Hello\n"
    assert content['mime'] == 'text/markdown'
    assert content['binary'] is False


def test_write_creates_parent_directories():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'deep/nested/path/file.txt', "data")
    content = fm.read_file(ws['id'], 'deep/nested/path/file.txt')
    assert content['content'] == "data"


def test_read_nonexistent_file_returns_none():
    ws = wm.create_workspace("FM")
    assert fm.read_file(ws['id'], 'markdown/missing.md') is None


def test_write_invalid_path_returns_none():
    ws = wm.create_workspace("FM")
    result = fm.write_file(ws['id'], '../escape.txt', "x")
    assert result is None


def test_read_blocks_path_traversal():
    ws = wm.create_workspace("FM")
    assert fm.read_file(ws['id'], '../etc/passwd') is None


def test_write_path_traversal_returns_none():
    ws = wm.create_workspace("FM")
    assert fm.write_file(ws['id'], '../../etc/passwd', "x") is None


def test_force_text_for_binary_extension():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'text/data.bin', "binary-looking but text")
    # Without force_text: would be binary
    no_force = fm.read_file(ws['id'], 'text/data.bin')
    assert no_force['binary'] is True
    # With force_text: returned as text
    forced = fm.read_file(ws['id'], 'text/data.bin', force_text=True)
    assert forced['binary'] is False
    assert forced['content'] == "binary-looking but text"


def test_delete_file():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'markdown/x.md', "data")
    assert fm.delete_file(ws['id'], 'markdown/x.md') is True
    assert fm.read_file(ws['id'], 'markdown/x.md') is None


def test_delete_nonexistent_file_returns_false():
    ws = wm.create_workspace("FM")
    assert fm.delete_file(ws['id'], 'markdown/missing.md') is False


def test_delete_empty_directory():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'markdown/sub/file.md', "x")
    fm.delete_file(ws['id'], 'markdown/sub/file.md')
    assert fm.delete_file(ws['id'], 'markdown/sub') is True


def test_list_files_root():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'markdown/a.md', "x")
    result = fm.list_files(ws['id'])
    assert result is not None
    names = [e['name'] for e in result['entries']]
    assert 'markdown' in names
    assert 'text' in names
    assert 'html' in names


def test_list_files_subdir():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'markdown/a.md', "1")
    fm.write_file(ws['id'], 'markdown/b.md', "22")
    result = fm.list_files(ws['id'], 'markdown')
    assert result is not None
    names = {e['name'] for e in result['entries']}
    assert names == {'a.md', 'b.md'}


def test_list_files_includes_updatedAt():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'markdown/a.md', "x")
    result = fm.list_files(ws['id'], 'markdown')
    file_entry = next(e for e in result['entries'] if e['name'] == 'a.md')
    assert 'updatedAt' in file_entry
    assert isinstance(file_entry['updatedAt'], str)
    assert 'T' in file_entry['updatedAt']  # ISO format


def test_list_files_directory_has_no_size():
    ws = wm.create_workspace("FM")
    result = fm.list_files(ws['id'])
    for entry in result['entries']:
        if entry['type'] == 'directory':
            assert 'size' not in entry


def test_list_files_file_has_size_and_mime():
    ws = wm.create_workspace("FM")
    fm.write_file(ws['id'], 'markdown/a.md', "x")
    result = fm.list_files(ws['id'], 'markdown')
    file_entry = next(e for e in result['entries'] if e['name'] == 'a.md')
    assert file_entry['size'] == 1
    assert file_entry['mime'] == 'text/markdown'


def test_list_nonexistent_dir_returns_none():
    ws = wm.create_workspace("FM")
    assert fm.list_files(ws['id'], 'nope') is None


def test_save_upload_writes_to_subdir():
    ws = wm.create_workspace("FM")
    result = fm.save_upload(ws['id'], 'test.txt', b'hello', 'files')
    assert result['path'] == 'files/test.txt'
    assert result['size'] == 5
    content = fm.read_file(ws['id'], 'files/test.txt', force_text=True)
    assert content['content'] == 'hello'


def test_save_upload_invalid_path_raises():
    ws = wm.create_workspace("FM")
    import pytest
    with pytest.raises(ValueError):
        fm.save_upload(ws['id'], 'x.txt', b'data', '../escape')


def test_mime_detection_for_various_extensions():
    ws = wm.create_workspace("FM")
    cases = [
        ('markdown/a.md', 'text/markdown'),
        ('text/a.txt', 'text/plain'),
        ('html/a.html', 'text/html'),
        ('text/a.json', 'application/json'),
    ]
    for path, expected_mime in cases:
        fm.write_file(ws['id'], path, "x")
        result = fm.read_file(ws['id'], path)
        assert result['mime'] == expected_mime, f"{path} -> {result['mime']} != {expected_mime}"