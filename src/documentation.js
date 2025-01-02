"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.docs = void 0;
exports.docs = `openapi: 3.0.3
info:
  title: AMBRodeo API
  description: API documentation for AMBRodeo API
  version: "1.0.0"
components:
  headers:
    SignatureHeader:
      description: Signature for secret message.
      schema:
        type: string
    AddressHeader:
      description: Wallet address header used for authentication.
      schema:
        type: string
  parameters:
    GlobalSignatureHeader:
      name: Signature
      in: header
      required: true
      description: Signature for secret message.
      schema:
        type: string
    GlobalAddressHeader:
      name: Address
      in: header
      required: true
      description: Wallet address header.
      schema:
        type: string

paths:
  /:
    get:
      summary: Root endpoint
      responses:
        "200":
          description: Empty JSON response
          content:
            application/json:
              schema:
                type: object
  /upload:
    post:
      summary: Upload a file
      parameters:
        - $ref: '#/components/parameters/GlobalSignatureHeader'
        - $ref: '#/components/parameters/GlobalAddressHeader'
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses:
        "200":
          description: File uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
                  filename:
                    type: string
        "400":
          description: No file uploaded
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/user:
    post:
      summary: Add or update a user
      parameters:
        - $ref: '#/components/parameters/GlobalSignatureHeader'
        - $ref: '#/components/parameters/GlobalAddressHeader'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                userName:
                  type: string
                image:
                  type: string
      responses:
        "200":
          description: User added or updated
        "400":
          description: Invalid JSON payload
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
    get:
      summary: Get user by address
      parameters:
        - $ref: '#/components/parameters/GlobalAddressHeader'
      responses:
        "200":
          description: User data
          content:
            application/json:
              schema:
                type: object
                properties:
                  address:
                    type: string
                  userName:
                    type: string
                  image:
                    type: string
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/message:
    post:
      summary: Add a message
      parameters:
        - $ref: '#/components/parameters/GlobalSignatureHeader'
        - $ref: '#/components/parameters/GlobalAddressHeader'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                tokenAddress:
                  type: string
                message:
                  type: string
      responses:
        "200":
          description: Message added successfully
        "400":
          description: Invalid JSON payload or missing required fields
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/like:
    post:
      summary: Add or remove a like for a token
      parameters:
        - $ref: '#/components/parameters/GlobalSignatureHeader'
        - $ref: '#/components/parameters/GlobalAddressHeader'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                tokenAddress:
                  type: string
                like:
                  type: boolean
      responses:
        "200":
          description: Like added or removed successfully
        "400":
          description: Invalid JSON payload or missing required fields
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/messages:
    get:
      summary: Get messages for a specific token
      parameters:
        - name: tokenAddress
          in: query
          required: true
          schema:
            type: string
        - name: skip
          in: query
          required: false
          schema:
            type: integer
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: List of messages
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    address:
                      type: string
                    tokenAddress:
                      type: string
                    message:
                      type: string
                    timestamp:
                      type: string
                      format: date-time
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/token:
    get:
      summary: Get token by address
      parameters:
        - name: tokenAddress
          in: query
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Token data
          content:
            application/json:
              schema:
                type: object
                properties:
                  tokenAddress:
                    type: string
                  like:
                    type: integer
                  timestamp:
                    type: string
                    format: date-time
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/likes:
    get:
      summary: Get likes for a user
      parameters:
        - $ref: '#/components/parameters/GlobalAddressHeader'
        - name: skip
          in: query
          required: false
          schema:
            type: integer
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: List of likes
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    address:
                      type: string
                    tokenAddress:
                      type: string
                    timestamp:
                      type: string
                      format: date-time
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/secret:
    get:
      summary: Get a secret for the user address
      parameters:
        - $ref: '#/components/parameters/GlobalAddressHeader'
      responses:
        "200":
          description: Secret generated
          content:
            application/json:
              schema:
                type: object
                properties:
                  secret:
                    type: string
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
`;
