# Notify Hub: Agent Integration Guide

This guide explains the architecture, core concepts, and integration pathways for **Notify Hub**, a standalone, multi-tenant notification delivery platform. If you are an agent working on an external application (e.g., CP Hub) and need to dispatch notifications, you will use Notify Hub.

## 1. Core Architecture

Notify Hub is strictly responsible for the **delivery** of notification payloads. It is agnostic to the consuming application's UI/UX.

- **FastAPI Backend (`/backend`)**: Handles API ingestion, CRUD operations for tenant configurations, and security. Runs on `http://localhost:8001` so it can run alongside CP Hub on port 8000.
- **Celery & RabbitMQ (`/backend`)**: Asynchronous worker queue that processes notification jobs, renders templates using Jinja2, and executes delivery via Adapters.
- **React Admin Portal (`/frontend`)**: A unified dashboard to manage Applications, Environments, Workflows, and multi-channel Templates. Runs on `http://localhost:5173`.

## 2. Core Concepts

### Applications & API Keys
Every external service (e.g., "CP Hub") is registered as an **Application** in Notify Hub. Applications have environments (e.g., Development, Production), each with a unique, securely hashed **API Key** used to authenticate ingestion requests.

### Workflows & Multi-Channel Templates
A **Workflow** represents a logical event (e.g., `order_shipped`, `new_comment`). 
- A single Workflow handles **multiple channels** (Email and In-App) simultaneously. 
- You do not create separate workflows per channel. You create one Workflow and configure its Channel Templates (Subject, HTML Body for Email; Title, Body, Action URL for In-App).
- Templates use **Jinja2 syntax** for dynamic variable interpolation (e.g., `Hello {{ user.name }}`).

### Delivery Adapters
- **Email**: Renders the HTML/Text templates and dispatches them (via Resend or a mock console logger).
- **In-App (Webhooks)**: Fires an HTTP POST request to the target Application's registered webhook URL. 
  - The payload contains the rendered In-App JSON data.
  - The request is secured with an **HMAC-SHA256 signature** in the `X-Hub-Signature` header, which the consuming app must verify.

---

## 3. How to Trigger a Notification

To trigger a notification from your external application, make an HTTP POST request to Notify Hub's ingestion endpoint.

**Endpoint**: `POST http://localhost:8001/v1/events`
**Headers**: 
- `Authorization: Bearer <YOUR_API_KEY>`
- `Content-Type: application/json`

**Payload Structure**:
```json
{
  "event_id": "unique-id-for-idempotency-12345",
  "workflow_key": "user_signed_up",
  "recipients": [
    {
      "user_id": "user_789",
      "email": "alex@example.com"
    }
  ],
  "data": {
    "user": {
      "name": "Alex",
      "tier": "Pro"
    }
  }
}
```

### Idempotency
Notify Hub uses `event_id` to guarantee **Exactly-Once Delivery**. If you send multiple requests with the same `event_id`, Notify Hub will safely ignore the duplicates and return a `200 OK` without re-triggering the notification workflow.

---

## 4. How to Handle In-App Webhooks (Consuming App)

When a Workflow triggers an In-App notification, Notify Hub sends a POST request to your app's webhook URL.

**Your app's responsibilities:**
1. **Verify the Signature**: Compute the HMAC-SHA256 hash of the raw request body using your Application's Secret Key. Ensure it matches the `X-Hub-Signature` header provided by Notify Hub.
2. **Render the UI**: Notify Hub provides the *data*, your app provides the *UI*.
   
**Webhook Payload Example**:
```json
{
  "event_id": "unique-id-for-idempotency-12345",
  "workflow": "user_signed_up",
  "content": {
    "title": "Welcome to Pro, Alex!",
    "body": "Enjoy your new features.",
    "action_url": "https://yourapp.com/dashboard"
  }
}
```
Your app should store this payload locally and render it as a toast, a notification bell dropdown, or a banner according to your native design system.
