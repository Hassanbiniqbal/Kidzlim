# Brevo email templates

Create one **transactional template** in Brevo for each file below (Brevo → Transactional →
Templates → New template → *Paste your code*), then copy each template's numeric ID into
**Admin → Store Settings → Brevo → Templates**.

| Settings field | File | Suggested subject |
|---|---|---|
| Order confirmation | `order-confirmation.html` | Your Kidzlim order {{ params.orderNumber }} is confirmed |
| Digital delivery | `digital-delivery.html` | Your Kidzlim books are ready to download |
| Download resend | `digital-delivery.html` (same HTML) | Your new Kidzlim download link |
| Shipping notification | `shipping-notification.html` | Your Kidzlim books are on their way 📦 |

The params each template receives are listed in the comment at the top of each file.
`storeName` and `supportEmail` are added to every email automatically.

**Sender:** set *Sender name* and *Sender email* in Store Settings → Brevo. The sending domain
must be authenticated in Brevo (SPF, DKIM, DMARC) before go-live, or Gmail will junk
paid-order emails (brief §7).

**Local testing without Brevo:** set `BREVO_MOCK=1` in `.env` (development only) — emails are
printed to the server log instead of being sent.
