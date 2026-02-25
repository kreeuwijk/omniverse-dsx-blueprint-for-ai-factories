# Testing Artifact Collection

Guide for testing artifact collection with different exit scenarios and the `ARTIFACT_UPLOAD_ON_ERROR_ONLY` setting using MinIO (local S3-compatible storage).

## Setup MinIO

```bash
# Start MinIO server
docker run -d \
  --name minio-test \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create bucket via MinIO console at http://localhost:9001 (minioadmin/minioadmin)
# Or use mc (MinIO client):
docker run --rm --network host minio/mc alias set local http://localhost:9000 minioadmin minioadmin
docker run --rm --network host minio/mc mb local/kit-artifacts
```

## Common Environment Variables

```bash
COMMON_ENV="
  -e ARTIFACT_STORAGE_URI=s3://kit-artifacts \
  -e ARTIFACT_UPLOAD_ON_ERROR_ONLY=true \
  -e AWS_ACCESS_KEY_ID=minioadmin \
  -e AWS_SECRET_ACCESS_KEY=minioadmin \
  -e AWS_DEFAULT_REGION=us-east-1 \
  -e AWS_ENDPOINT_URL=http://localhost:9000"
```

## Test Scenarios

### 1. Success (Exit 0) - Should Skip Upload

```bash
# Run the container and pass command to quit after 10 frames
docker run --rm --network host \
  -e ARTIFACT_PATH_TEMPLATE="test-success-{datetime}" \
  ${COMMON_ENV} \
  your-kit-container:latest --/app/quitAfter=10

# Expected: Logs show "Skipping artifact upload"
# MinIO: No artifacts uploaded
```

### 2. Application Failure - Should Upload

```bash
# Inject failure into your Kit app, example here is to pass non-existing extension:
docker run --rm --network host \
  -e ARTIFACT_PATH_TEMPLATE="test-failure-{datetime}" \
  ${COMMON_ENV} \
  your-kit-container:latest --enable non-existing-extension

# Expected: Logs show "exit code is X (error)" and "Proceeding with artifact upload"
# MinIO: Artifacts uploaded with correct exit_code in metadata.json
```

### 3. SIGTERM (Exit 143) - Should Upload

```bash
docker run -d --name test-sigterm --network host \
  -e ARTIFACT_PATH_TEMPLATE="test-sigterm-{datetime}" \
  ${COMMON_ENV} \
  your-kit-container:latest

sleep 5
docker kill --signal=TERM test-sigterm
docker logs test-sigterm

# Expected: exit_code=143, artifacts uploaded
# MinIO: Artifacts with metadata.json showing exit_code: 143
```

### 4. SIGINT (Exit 130) - Should Upload

```bash
docker run -d --name test-sigint --network host \
  -e ARTIFACT_PATH_TEMPLATE="test-sigint-{datetime}" \
  ${COMMON_ENV} \
  your-kit-container:latest

sleep 5
docker kill --signal=INT test-sigint
docker logs test-sigint

# Expected: exit_code=130, artifacts uploaded
```

### 5. SIGKILL - No Upload (Expected)

```bash
docker run -d --name test-sigkill --network host \
  -e ARTIFACT_PATH_TEMPLATE="test-sigkill-{datetime}" \
  ${COMMON_ENV} \
  your-kit-container:latest

sleep 5
docker kill --signal=KILL test-sigkill

# Expected: Container killed immediately, no upload (SIGKILL cannot be trapped)
```

## Verification

Check MinIO Console at http://localhost:9001 (minioadmin/minioadmin):
- Browse `kit-artifacts` bucket
- Each test creates a folder with timestamp
- Verify `metadata.json` shows correct `exit_code`

Expected structure:
```
kit-artifacts/
└── test-sigterm-2026-01-14_10-30-15/
    ├── metadata.json (contains exit_code field)
    ├── kit_20260114_103015.log
    └── ct-profile_*.json.gz (if profiler enabled)
```

## Cleanup

```bash
docker stop minio-test && docker rm minio-test
```
