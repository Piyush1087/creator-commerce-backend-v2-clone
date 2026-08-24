# Gatekeeper v1 recovery capabilities

These contracts close the executable capabilities behind the recovery actions
returned by Gatekeeper v1. They do not change admission outcomes, review
eligibility, Industry confirmation, or organization membership.

All request bodies pass the application's global validation pipe. Unknown
fields are stripped and invalid fields are rejected. An optional bearer token
and `x-session-id` header are captured as traceability metadata when present.

## Request organization access

```http
POST /api/v1/discovery/:leadId/request-org-access
Content-Type: application/json

{
  "requesterEmail": "requester@example.com",
  "authorizedRepresentativeAttested": true,
  "requesterName": "Optional name",
  "requesterNote": "Optional context, up to 1000 characters"
}
```

The persisted Gatekeeper result must still be `ORG_CLAIMED` and include
`REQUEST_ORG_ACCESS`. The backend resolves the verified Brand Profile and
organization from the persisted normalized domain; no client-supplied
organization identity is accepted. Creating this request does not add a user,
send an invitation, or grant organization access.

## Request classification review

```http
POST /api/v1/discovery/:leadId/request-classification-review
Content-Type: application/json

{
  "requesterEmail": "requester@example.com",
  "authorizedRepresentativeAttested": true,
  "requesterName": "Optional name",
  "requesterNote": "Optional review context, up to 1000 characters"
}
```

The persisted Gatekeeper result must:

- have outcome `CLASSIFICATION_UNCERTAIN` or `UNSUPPORTED`;
- have `manual_review_eligible=true`; and
- include `REQUEST_CLASSIFICATION_REVIEW` in `recovery_actions`.

Calling the endpoint is the explicit user action that creates the record.
`manual_review_eligible` alone does not create one. An accepted supported
Industry override and its `industry_disagreement_flag` do not create or permit
a classification-review request.

## Request response and idempotency

Both mutation endpoints return HTTP `201`:

```json
{
  "request": {
    "id": "recovery-request-uuid",
    "type": "REQUEST_ORG_ACCESS",
    "status": "RECEIVED",
    "discoveryLeadId": "discovery-lead-uuid",
    "normalizedDomain": "example.com",
    "submittedAt": "2026-08-21T12:00:00.000Z"
  }
}
```

`type` is `REQUEST_ORG_ACCESS` or `REQUEST_CLASSIFICATION_REVIEW`. Repeating
the same request type for the same Discovery Lead and normalized requester
email returns the same durable record. A database uniqueness constraint makes
concurrent retries converge.

The service returns a structured HTTP `400` when the persisted Gatekeeper
state does not authorize the requested action. Organization requests return a
structured HTTP `409` when the previously claimed organization can no longer
be resolved.

## Contact support

Configure the canonical public destination in `GATEKEEPER_SUPPORT_URL` using
an absolute `https://` or `http://` URL. No ticketing subsystem is introduced.

```http
GET /api/v1/discovery/support
```

```json
{
  "support": {
    "type": "URL",
    "href": "https://configured-support-destination.example/path"
  }
}
```

Missing or invalid configuration fails closed with HTTP `503` and code
`GATEKEEPER_SUPPORT_NOT_CONFIGURED`.
