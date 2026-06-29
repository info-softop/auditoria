# Despliegue en GCP — Auditoría Softop

Reusa el **mismo proyecto GCP de softop-administrador** (`softop-admin-prod`,
región `us-central1`) y su **instancia Cloud SQL** `softop-admin-db` (PostgreSQL 18),
creando una **base de datos aparte** para no mezclar datos.

```
Cloud Run (auditoria)
   ├── Cloud SQL  softop-admin-db  → base nueva: auditoria_opticas
   ├── Cloud Storage  bucket de fotos
   └── Secret Manager  AUDITORIA_AUTH_SECRET, AUDITORIA_DATABASE_URL
```

Variables (pégalas en tu terminal; confirma el project con `gcloud config get-value project`):

```bash
export PROJECT=divine-actor-288515       # proyecto "SOFTOP SERVER"
export REGION=us-central1
export SQL_INSTANCE=softop-pg
export SQL_CONN=divine-actor-288515:us-central1:softop-pg   # "Nombre de conexión"
export DB_NAME=auditoria_opticas
export DB_USER=auditoria
export DB_PASS='UNA_CLAVE_FUERTE'
export REPO=auditoria
export SERVICE=auditoria
export BUCKET=auditoria_opticas          # bucket de fotos (creado en consola)
gcloud config set project $PROJECT
```

> Confirma `PROJECT`, `REGION` y el connection name con:
> ```bash
> gcloud config get-value project
> gcloud sql instances describe softop-pg --format='value(connectionName)'
> ```

---

## 1. Base de datos (instancia existente softop-pg)

La base `auditoria_opticas` **ya existe** ✓. Solo falta crear el **usuario**:

```bash
gcloud sql users create $DB_USER --instance=$SQL_INSTANCE --password="$DB_PASS"
```
> (Atajo: si prefieres no crear usuario, puedes usar el usuario `postgres` existente y su clave.)

## 2. Bucket de fotos (PRIVADO)

El bucket `auditoria_opticas` ya existe ✓ y queda **privado** (la org tiene
prevención de acceso público). Las fotos se sirven por el endpoint autenticado
`/api/uploads/[file]` de la app — NO se hace público el bucket. El único permiso
necesario es para la cuenta de servicio de Cloud Run (Paso 7, `objectAdmin`).

## 3. Secretos (prefijo AUDITORIA_ para no chocar con softop-admin)

```bash
openssl rand -base64 32 | gcloud secrets create AUDITORIA_AUTH_SECRET --data-file=-

printf "postgresql://%s:%s@localhost/%s?host=/cloudsql/%s" \
  "$DB_USER" "$DB_PASS" "$DB_NAME" "$SQL_CONN" \
  | gcloud secrets create AUDITORIA_DATABASE_URL --data-file=-
```

## 4. Artifact Registry (repo nuevo para esta app)

```bash
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION
```

## 5. Migrar la base (primera vez) — vía Cloud SQL Auth Proxy

```bash
./cloud-sql-proxy $SQL_CONN &     # abre localhost:5432
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" npx prisma migrate deploy
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" npm run db:seed   # usuario admin
```
> Después, en cada deploy con Cloud Build, las migraciones corren solas (Cloud Run Job `auditoria-migrate`).

## 6. Construir y desplegar

### Opción A — manual (rápido, primera vez)
```bash
export IMAGE=$REGION-docker.pkg.dev/$PROJECT/$REPO/web:latest
gcloud builds submit --tag $IMAGE

gcloud run deploy $SERVICE \
  --image=$IMAGE --region=$REGION --platform=managed --allow-unauthenticated \
  --add-cloudsql-instances=$SQL_CONN \
  --set-secrets=AUTH_SECRET=AUDITORIA_AUTH_SECRET:latest,DATABASE_URL=AUDITORIA_DATABASE_URL:latest \
  --set-env-vars=NODE_ENV=production,AUTH_TRUST_HOST=true,GCS_BUCKET=$BUCKET \
  --memory=512Mi --cpu=1 --min-instances=0 --max-instances=4
```
Imprime la URL pública (`https://auditoria-xxxx.run.app`).

### Opción B — automático (CI/CD, recomendado a futuro)
Crea un trigger que use el `cloudbuild.yaml` del repo (build → push → migrar → deploy en cada push a `main`):
```bash
gcloud builds triggers create github \
  --repo-name=Auditoria-Opticas --repo-owner=TU_ORG \
  --branch-pattern='^main$' --build-config=cloudbuild.yaml
```
(Los valores `_REGION/_ARTIFACT_REPO/_SERVICE_NAME/_CLOUD_SQL_CONN/_BUCKET` ya vienen por defecto en el `cloudbuild.yaml`.)

## 7. Permiso del bucket para Cloud Run

```bash
export RUN_SA=$(gcloud run services describe $SERVICE --region=$REGION --format='value(spec.template.spec.serviceAccountName)')
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:$RUN_SA --role=roles/storage.objectAdmin
```

## 8. Dominio propio (opcional)
```bash
gcloud run domain-mappings create --service=$SERVICE --domain=auditoria.softop.la --region=$REGION
```

---

## Re-despliegue manual
```bash
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT/$REPO/web:latest
# si hay migraciones nuevas: paso 5 (proxy) o el Job auditoria-migrate
gcloud run deploy $SERVICE --image=$REGION-docker.pkg.dev/$PROJECT/$REPO/web:latest --region=$REGION
```

## Notas
- **No tocar `softop-admin-db` salvo crear la base nueva**: comparten instancia, datos aislados por base/usuario.
- Secrets de esta app van **prefijados `AUDITORIA_`** para no pisar los de softop-admin.
- Fotos: con `GCS_BUCKET` set, se guardan en Cloud Storage (no en el disco efímero de Cloud Run).
- Costo extra ≈ casi nulo: reusa instancia SQL y Cloud Run escala a cero. Solo suma el bucket (centavos).
