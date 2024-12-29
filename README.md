# Fastify Server Documentation

## Overview
This documentation provides explanation of a ambrodeo server implementation. The server is designed to handle user authentication, file uploads, and various API endpoints to manage users, messages, likes. It also includes OpenAPI documentation using Swagger.

---

## Table of Contents
1. [Environment Variables](#environment-variables)
2. [Initialization](#initialization)
3. [Middleware and Hooks](#middleware-and-hooks)
4. [Routes](#routes)
    - [GET /](#get-)
    - [POST /upload](#post-upload)
    - [POST /api/user](#post-apiuser)
    - [POST /api/message](#post-apimessage)
    - [POST /api/like](#post-apilike)
    - [GET /api/user](#get-apiuser)
    - [GET /api/messages](#get-apimessages)
    - [GET /api/token](#get-apitoken)
    - [GET /api/likes](#get-apilikes)
    - [GET /api/secret](#get-apisecret)
5. [Utility Functions](#utility-functions)
6. [Error Handling](#error-handling)

---

## Environment Variables
The application relies on the following environment variables, fetched using `getEnv`:
- `HOST`: Host address of the server.
- `PORT`: Port number for the server.
- `DATABASE_URL`: MongoDB connection URL.
- `SUBGRAPHS_ENDPOINT`: GraphQL endpoint for querying tokens.
- `UPLOAD_DIR`: Directory for uploaded files.

---

## Initialization
The server is initialized using `initFastify()`. It registers plugins for:
- **Swagger**: For OpenAPI documentation.
- **MongoDB**: To interact with a MongoDB database.
- **Multipart**: To handle file uploads.

An OpenAPI specification is loaded from the `docs` YAML file.

---

## Middleware and Hooks
### Pre-handler Hook
- Validates requests with `POST` methods by checking for an `address` and `signature` in headers.
- Verifies the signature using `ethers.verifyMessage`.
- Responds with appropriate error codes for invalid or missing credentials.

---

## Routes

### GET /
**Description**: Basic health check endpoint.
- **Response**: Empty object `{}`.

### POST /upload
**Description**: Handles file uploads.
- **Headers**: Requires `address`.
- **Process**:
  - Ensures a directory exists for the uploaded file.
  - Saves the file in the appropriate path.
- **Response**: Success or error message.

### POST /api/user
**Description**: Adds or updates user details.
- **Headers**: Requires `address`.
- **Body**:
  - `userName`: User's name.
  - `image`: Profile image URL.
- **Response**: Empty on success or error message.

### POST /api/message
**Description**: Adds a message associated with a token.
- **Headers**: Requires `address`.
- **Body**:
  - `tokenAddress`: Address of the token.
  - `message`: Message content.
- **Response**: Empty on success or error message.

### POST /api/like
**Description**: Adds or deletes a like for a token.
- **Headers**: Requires `address`.
- **Body**:
  - `tokenAddress`: Address of the token.
  - `like`: Boolean indicating whether to add or remove the like.
- **Response**: Empty on success or error message.

### GET /api/user
**Description**: Fetches details of a user.
- **Headers**: Requires `address`.
- **Response**: User object or error message.

### GET /api/messages
**Description**: Retrieves messages for a token.
- **Query Parameters**:
  - `tokenAddress`: Token address to fetch messages for.
  - `skip`: Number of records to skip.
  - `limit`: Maximum number of records to fetch.
- **Response**: List of messages or error message.

### GET /api/token
**Description**: Retrieves details of a token.
- **Query Parameters**:
  - `tokenAddress`: Token address to fetch.
- **Response**: Token object or error message.

### GET /api/likes
**Description**: Retrieves likes for a user.
- **Headers**: Requires `address`.
- **Query Parameters**:
  - `skip`: Number of records to skip.
  - `limit`: Maximum number of records to fetch.
- **Response**: List of likes or error message.

### GET /api/secret
**Description**: Generates and retrieves a secret for an address.
- **Headers**: Requires `address`.
- **Response**: Secret string or error message.

---

## Utility Functions

### checkTokenExist
**Purpose**: Checks if a token exists in the database or the subgraph.
- **Parameters**:
  - `request`: FastifyRequest.
  - `tokenAddress`: Token address to verify.
- **Process**:
  - Searches the database for the token.
  - Queries the subgraph if not found.
  - Updates the database if the token exists in the subgraph.
- **Returns**: `true` if token exists, `false` otherwise.

---

## Error Handling
The server employs consistent error handling with meaningful status codes and messages:
- **400 Bad Request**: For missing or invalid parameters.
- **401 Unauthorized**: For invalid signatures.
- **404 Not Found**: For non-existent tokens.
- **500 Internal Server Error**: For unexpected errors.
