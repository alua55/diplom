# DamiFood

Көпбетті food delivery веб-қосымша: frontend бөлек HTML беттерден тұрады, backend Node.js арқылы жұмыс істейді, деректер `data/db.json` файлына сақталады.

## Іске қосу

```bash
npm start
```

Сосын браузерде ашыңыз:

```text
http://localhost:3000
```

## Демо аккаунттар

- `admin@dami.kz` / `Admin123`
- `courier@dami.kz` / `Courier123`
- `owner@dami.kz` / `Owner123`

## Yandex Maps

Нақты карта үшін `data/db.json` ішіндегі:

```json
"yandexApiKey": "YOUR_YANDEX_MAPS_API_KEY"
```

мәнін өз API key-іңізге ауыстырыңыз. Егер `db.json` әлі жасалмаса, серверді бір рет іске қосыңыз.
