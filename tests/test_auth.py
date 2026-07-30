"""Tests for authentication."""
import pytest
from backend import auth


def test_create_user():
    auth._users.clear()
    auth._auth_required = False
    info = auth.create_user('alice', 'secret123')
    assert info['username'] == 'alice'


def test_create_user_duplicate_raises():
    auth._users.clear()
    auth.create_user('bob', 'pw')
    with pytest.raises(ValueError):
        auth.create_user('bob', 'pw')


def test_authenticate_success():
    auth._users.clear()
    auth.create_user('carol', 'pwd')
    token = auth.authenticate('carol', 'pwd')
    assert token is not None


def test_authenticate_wrong_password():
    auth._users.clear()
    auth.create_user('dave', 'right')
    assert auth.authenticate('dave', 'wrong') is None


def test_authenticate_unknown_user():
    auth._users.clear()
    assert auth.authenticate('nobody', 'x') is None


def test_verify_token():
    auth._users.clear()
    auth.create_user('eve', 'pw')
    token = auth.authenticate('eve', 'pw')
    assert auth.verify_token(token) == 'eve'


def test_verify_invalid_token():
    auth._users.clear()
    assert auth.verify_token('garbage') is None


def test_logout():
    auth._users.clear()
    auth.create_user('frank', 'pw')
    token = auth.authenticate('frank', 'pw')
    assert auth.logout(token) is True
    assert auth.verify_token(token) is None


def test_logout_invalid():
    assert auth.logout('not-a-token') is False


def test_is_required_with_users():
    auth._users.clear()
    auth._auth_required = False
    assert auth.is_required() is False
    auth.create_user('gina', 'pw')
    assert auth.is_required() is True


def test_is_required_via_env(monkeypatch):
    auth._users.clear()
    auth._auth_required = False
    monkeypatch.setenv('WORKSPACE_AUTH', '1')
    auth._load_users()  # reload to pick up env
    assert auth.is_required() is True


def test_list_users():
    auth._users.clear()
    auth.create_user('h', 'pw')
    auth.create_user('i', 'pw')
    assert set(auth.list_users()) >= {'h', 'i'}


def test_delete_user():
    auth._users.clear()
    auth.create_user('jane', 'pw')
    token = auth.authenticate('jane', 'pw')
    assert auth.delete_user('jane') is True
    assert auth.verify_token(token) is None


def test_delete_user_nonexistent():
    assert auth.delete_user('nobody') is False


def test_load_users_handles_missing_file(tmp_path, monkeypatch):
    """If users.json doesn't exist, load gracefully."""
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'no_users')
    auth._load_users()
    assert auth._users == {}


def test_load_users_handles_corrupt(tmp_path, monkeypatch):
    from backend import safe_fs
    (tmp_path / 'corrupt').mkdir()
    users_json = tmp_path / 'corrupt' / 'users.json'
    users_json.write_text('NOT JSON {{{')
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'corrupt')
    auth._load_users()
    assert auth._users == {}


# --- API ---

def test_auth_status_no_users(client):
    auth._users.clear()
    auth._auth_required = False
    res = client.get('/api/auth/status')
    assert res.status_code == 200
    assert res.get_json()['data'] == {'required': False}


def test_auth_register(client):
    auth._users.clear()
    res = client.post('/api/auth/register', json={'username': 'newone', 'password': 'pw'})
    assert res.status_code == 201


def test_auth_register_missing_fields(client):
    res = client.post('/api/auth/register', json={})
    assert res.status_code == 400


def test_auth_register_duplicate(client):
    auth._users.clear()
    auth.create_user('dup', 'pw')
    res = client.post('/api/auth/register', json={'username': 'dup', 'password': 'pw'})
    assert res.status_code == 409


def test_auth_login_success(client):
    auth._users.clear()
    auth.create_user('loginuser', 'pw')
    res = client.post('/api/auth/login', json={'username': 'loginuser', 'password': 'pw'})
    assert res.status_code == 200
    body = res.get_json()
    assert 'token' in body['data']


def test_auth_login_failure(client):
    auth._users.clear()
    auth.create_user('failuser', 'right')
    res = client.post('/api/auth/login', json={'username': 'failuser', 'password': 'wrong'})
    assert res.status_code == 401


def test_auth_logout(client):
    auth._users.clear()
    auth.create_user('logoutuser', 'pw')
    login_res = client.post('/api/auth/login', json={'username': 'logoutuser', 'password': 'pw'})
    token = login_res.get_json()['data']['token']
    res = client.post('/api/auth/logout', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200


def test_auth_logout_no_token(client):
    res = client.post('/api/auth/logout')
    assert res.status_code == 400


def test_auth_me_with_token(client):
    auth._users.clear()
    auth.create_user('meuser', 'pw')
    login_res = client.post('/api/auth/login', json={'username': 'meuser', 'password': 'pw'})
    token = login_res.get_json()['data']['token']
    res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert res.get_json()['data']['username'] == 'meuser'


def test_auth_me_invalid_token(client):
    res = client.get('/api/auth/me', headers={'Authorization': 'Bearer garbage'})
    assert res.status_code == 401