# Void.O 경량랙 조립 매뉴얼 생성기

치수·형태·옵션·문구를 입력하면 **아이소메트릭(ISO) 라인 조립도 + 단계별 매뉴얼**을 결정적으로 생성하는 단일 HTML 웹앱. 모바일 웹 + 인쇄/PDF. 고객 직접 조립용.

브랜드: **Void.O** (주식회사 디엘나인)

**🔗 라이브:** https://nakedsoul75.github.io/voido-rack-manual/

박스/제품 부착용 QR: [`assets/qr.svg`](assets/qr.svg) · [`assets/qr.png`](assets/qr.png)

## 실행

단일 정적 파일입니다. 별도 빌드 없음.

```bash
# 로컬 미리보기
python -m http.server 8099
# → http://localhost:8099/
```

또는 `index.html`을 브라우저로 직접 엽니다.

## 배포

- **GitHub Pages**: `main` 브랜치 루트의 `index.html`을 그대로 서빙.
- **Vercel**: 정적 사이트로 zero-config 배포 가능(이 레포 연결 시 즉시 동작).

## 구조 (단일 파일 `index.html`)

- `STATE` ← 단일 상태원 (meta/dims/options/contact/text), localStorage 자동저장
- ISO 엔진: `P()` 투영 → `cuboid()` → `render()`(깊이정렬+SVG), `geo()` 치수→부재두께
- `postSegments()` 기둥 단별 분할 (뒷다리 오클루전 해결)
- `rackParts()` 단일 베이 / `runParts()` 연결 베이(기둥 공유)
- `DIA{}` 단계별 도식 빌더
- `calcBOM()` / `buildSteps()` / `renderManual()`
- 모델 DB: `getDB`/`setDB`/`allModels`/`BUILTIN_MODELS` (모델코드 PK, JSON state)

상세 아키텍처·로드맵: [`docs/HANDOFF.md`](docs/HANDOFF.md)

## 라이선스

사내 전용 (주식회사 디엘나인).
