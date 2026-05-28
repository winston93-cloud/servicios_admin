# Git de deploy (Vercel u otro hosting)

Este proyecto usa **dos remotos**:

| Remoto | Repositorio | Uso |
|--------|-------------|-----|
| `origin` | `winston93-cloud/servicios_admin` | Desarrollo (rama `desayunos`) |
| Deploy | `winston93-cloud/servicios-admin-deploy` | Espejo para producción (`main`) |

Vercel (u otro) debe enlazarse a **`servicios-admin-deploy`**, rama **`main`**, no al repo de desarrollo.

## Actualizar producción después de cambios

```bash
./scripts/push-deploy-remote.sh
```

O desde la raíz del repo de desarrollo:

```bash
git push deploy desayunos:main
```

(si añadiste `git remote add deploy https://github.com/winston93-cloud/servicios-admin-deploy.git`)

## Carpeta local espejo

`../servicios_admin_deploy` — clon de trabajo; `upstream` apunta a este repo, `origin` al repo de deploy.
