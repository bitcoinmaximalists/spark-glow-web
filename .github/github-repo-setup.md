# GitHub SSH — bitcoinmaximalists account

Pushes are authenticated as **`bitcoinmaximalists`** via a dedicated SSH key and host alias.

## `~/.ssh/config` entry

```
Host github-bitcoinmaximalists
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_bitcoinmaximalists
  IdentitiesOnly yes
```

## Per-repo setup

```bash
git remote set-url origin git@github-bitcoinmaximalists:bitcoinmaximalists/spark-glow-web.git
git config user.name  "bitcoinmaximalists"
git config user.email "279365759+bitcoinmaximalists@users.noreply.github.com"
```

## Verify

```bash
ssh -T git@github-bitcoinmaximalists
# Hi bitcoinmaximalists! You've successfully authenticated...
```
