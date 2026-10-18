    if not valid_uri:
        raise HTTPException(
            status_code=500,
            detail="SALLA_REDIRECT_URI must be the plain HTTPS URL ending in /auth/callback",
        )

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code": code,
    }

    try:
        token_res = requests.post(
            TOKEN_URL,
            data=payload,
            headers={"Accept": "application/json"},
            timeout=HTTP_TIMEOUT,
            allow_redirects=False,
        )
        if token_res.status_code != 200:
            # لا نعيد محتوى استجابة التوكن الخام إلى المتصفح.
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Salla token request failed (HTTP {token_res.status_code}). "
                    "Check the app credentials and matching Redirect URI, then start a new authorization."
                ),
            )

        token_data = response_json(token_res, "token endpoint")
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        if not isinstance(access_token, str) or not access_token.strip():
            raise HTTPException(status_code=502, detail="Salla did not return an access token")
        if not isinstance(refresh_token, str) or not refresh_token.strip():
            raise HTTPException(
                status_code=502,
                detail="Salla did not return a refresh token. Include offline_access and authorize again.",
            )

        merchant_res = requests.get(
            USER_INFO_URL,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=HTTP_TIMEOUT,
            allow_redirects=False,
        )
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="The request to Salla timed out") from None
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Could not connect to Salla") from None

    if merchant_res.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch Salla store information (HTTP {merchant_res.status_code})",
        )

    user_response = response_json(merchant_res, "user information endpoint")
    user_info = user_response.get("data")
    merchant = user_info.get("merchant") if isinstance(user_info, dict) else None
    merchant_id = merchant.get("id") if isinstance(merchant, dict) else None

    # data.id يخص المستخدم؛ معرّف المتجر الصحيح هو data.merchant.id.
    # لا نحفظ التوكن باسم default_merchant عند فشل تحديد المتجر.
    if (
        user_response.get("success") is False
        or isinstance(merchant_id, bool)
        or not isinstance(merchant_id, (str, int))
        or not str(merchant_id).isdigit()
        or int(merchant_id) <= 0
    ):
        raise HTTPException(status_code=502, detail="Salla response is missing a valid merchant ID")

    merchant_id = str(merchant_id)
    store_name = merchant.get("name")
    if not isinstance(store_name, str) or not store_name.strip():
        store_name = merchant_id

    try:
        with closing(psycopg2.connect(database_url, connect_timeout=10)) as conn:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO stores (merchant_id, access_token, refresh_token, store_name)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (merchant_id)
                        DO UPDATE SET
                            access_token = EXCLUDED.access_token,
                            refresh_token = EXCLUDED.refresh_token,
                            store_name = EXCLUDED.store_name;
                    """, (merchant_id, access_token, refresh_token, store_name))
    except psycopg2.Error as exc:
        logger.error("Store authorization save failed: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="Could not save the store authorization") from None

    return {
        "status": "success",
        "merchant_id": merchant_id,
        "message": f"App installed and connected successfully for store: {store_name}!",
    }


@app.post("/webhook")
async def salla_webhook(request: Request):
    # يستقبل الأحداث ويسجل أسماءها فقط؛ مزامنة المنتجات لم تُنفذ بعد.
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object")
    event = payload.get("event")
    logger.info("Received Salla webhook event: %s", event)
    return {"status": "success", "event_received": event}


@app.get("/")
def read_root():
    return {"message": "Salla PageIndex Backend with Neon is running successfully!"}
