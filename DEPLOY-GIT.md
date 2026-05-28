# Repo de deploy (solo para Vercel)

No hay dos copias del código para programar. Solo esto:

| Dónde | Repo | Para qué |
|-------|------|----------|
| Trabajo diario | `winston93-cloud/servicios_admin` · rama `desayunos` | Desarrollo y historial |
| Producción | `winston93-cloud/servicios-admin-deploy` · rama `main` | Vercel lee **solo** este repo |

El repo `servicios-admin-deploy` se creó vacío para enlazarlo en Vercel cuando el repo grande no conectaba.

## Después de cada cambio

```bash
git push origin desayunos
git push deploy desayunos:main
```

## Vercel

1. Proyecto → **Settings** → **Git**
2. Repositorio: **`winston93-cloud/servicios-admin-deploy`**
3. Rama de producción: **`main`**

No enlaces Vercel a `servicios_admin` si ya usas el repo de deploy.

## Si aún no existe el remoto `deploy`

```bash
git remote add deploy https://github.com/winston93-cloud/servicios-admin-deploy.git
```
