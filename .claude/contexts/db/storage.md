# File Storage Strategy

## 설계 철학

Vision AI 프로젝트는 대량의 이미지 파일을 다루므로, 효율적이고 확장 가능한 파일 저장 전략이 필수적이다.

## 컨텐츠 주소 기반 저장 (Content-Addressable Storage)

### 원리
- 파일 내용의 SHA-256 해시를 저장 키로 사용
- 동일한 내용의 파일은 물리적으로 한 번만 저장 (dedup)
- 해시 기반 경로 샤딩으로 디렉토리당 파일 수 제한

### 경로 형식

```
{base_path}/{hash[0:2]}/{hash[2:4]}/{full_hash}.{extension}
```

예시:
```
data/storage/a1/b2/a1b2c3d4e5f6...789.jpg
data/storage/ff/00/ff00abcdef12...345.png
```

- 첫 2자리, 다음 2자리로 2단계 샤딩
- 최대 256 x 256 = 65,536개 디렉토리로 파일 분산
- 대규모 데이터셋에서도 파일시스템 성능 유지

## 중복 제거 (Deduplication)

### 업로드 흐름

```
1. 파일 수신
2. SHA-256 해시 계산
3. 같은 데이터셋 내 동일 해시 존재 확인
   ├── 중복 존재: DB 레코드만 생성 (물리 파일 저장 생략)
   └── 중복 없음: 물리 파일 저장 + DB 레코드 생성
4. 응답 반환
```

### 삭제 흐름

```
1. DB 레코드 삭제
2. 같은 storage_key를 참조하는 다른 레코드 확인
   ├── 참조 존재: 물리 파일 유지
   └── 참조 없음: 물리 파일 삭제 (마지막 참조 제거)
```

- 이 방식으로 중복 파일의 디스크 사용량을 최소화하면서도, 데이터 무결성을 보장한다.

## 스토리지 추상화 레이어

```python
class StorageBackend(ABC):
    async def save(self, key: str, data: bytes) -> str
    async def load(self, key: str) -> bytes
    async def delete(self, key: str) -> None
    async def exists(self, key: str) -> bool
```

### 현재 구현: LocalStorage
- 로컬 파일시스템에 직접 저장
- 개발 환경과 단일 서버 배포에 적합
- MinIO를 사용하지 않는 이유: GPU 학습과 CPU 경쟁을 피하기 위함 (D001)

### 향후 확장: S3Storage (예정)
- S3 호환 스토리지 (AWS S3, MinIO 등) 지원
- 멀티 서버 배포, CDN 연동 등에 필요
- `StorageBackend` 인터페이스만 구현하면 교체 가능

## 이미지 서빙

### API를 통한 서빙
- `GET /api/v1/images/{id}/file` → FileResponse로 이미지 전송
- JWT 인증: `?token=` 쿼리 파라미터 지원 (HTML `<img src>` 태그 호환)
- 프론트엔드에서는 이미지 URL에 토큰을 쿼리 파라미터로 붙여 사용

### 주의사항
- 정적 파일 서빙이 아닌 API 엔드포인트를 통한 서빙
- 대량 이미지 로딩 시 성능 고려 필요 (향후 CDN 또는 프록시 캐시 도입)
- 프론트엔드에서 가상화 스크롤로 동시 로딩 이미지 수 제한

## 배치 업로드

- 한 번에 최대 20개 파일 배치 업로드 (D017)
- 프론트엔드에서 파일 배열을 20개씩 분할하여 순차 전송
- 서버 부하와 메모리 사용을 제한하면서도 사용자 체감 속도 유지

## 폴더 구조

- 이미지의 `folder_path` 컬럼으로 가상 폴더 구조 구현
- 물리적 파일은 해시 기반 경로에 저장되지만, 논리적으로는 폴더 계층 제공
- `folder_meta` 테이블로 빈 폴더도 명시적으로 추적
