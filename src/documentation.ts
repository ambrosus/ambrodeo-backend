export const docs = `openapi: 3.0.3
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
  /api/upload:
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
                  cid:
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
      - name: address
        in: query
        required: true
        schema:
          type: string
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
                id:
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
  /api/follow:
    post:
      summary: Add or remove a follower
      description: Add a new follower or remove an existing one based on the request body.
      parameters:
      - $ref: '#/components/parameters/GlobalSignatureHeader'
      - $ref: '#/components/parameters/GlobalAddressHeader'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - userAddress
                - add
              properties:
                userAddress:
                  type: string
                  description: The address of the user to follow or unfollow.
                add:
                  type: boolean
                  description: Set to 'true' to follow or 'false' to unfollow the user.
      responses:
        "200":
          description: Success response
          content:
            application/json:
              schema:
                type: object
                additionalProperties: false
        "400":
          description: Invalid JSON payload or invalid/missing fields
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
  /api/userlike:
    post:
      summary: Add or remove a like for a user
      parameters:
        - $ref: '#/components/parameters/GlobalSignatureHeader'
        - $ref: '#/components/parameters/GlobalAddressHeader'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                userAddress:
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
  /api/messagelike:
    post:
      summary: Add or remove a like for a message
      parameters:
        - $ref: '#/components/parameters/GlobalSignatureHeader'
        - $ref: '#/components/parameters/GlobalAddressHeader'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
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
        - name: address
          in: query
          required: false
          schema:
            type: string
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
        - name: sort
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
                type: object
                properties:
                  total:
                    type: integer
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        _id:
                          type: string
                        address:
                          type: string
                        tokenAddress:
                          type: string
                        message:
                          type: string
                        id:
                          type: string
                        timestamp:
                          type: string
                          format: date-time
                        liked:
                          type: boolean
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/messagesbyuser:
    get:
      summary: Get messages for a specific user
      parameters:
        - name: address
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
                type: object
                properties:
                  total:
                    type: integer
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        _id:
                          type: string
                        address:
                          type: string
                        tokenAddress:
                          type: string
                        message:
                          type: string
                        id:
                          type: string
                        timestamp:
                          type: string
                          format: date-time
                        liked:
                          type: boolean
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/messagereplies:
    get:
      summary: Get replies for a specific message
      parameters:
      - name: address
        in: query
        required: false
        schema:
          type: string
      - name: id
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
                type: object
                properties:
                  total:
                    type: integer
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        _id:
                          type: string
                        address:
                          type: string
                        tokenAddress:
                          type: string
                        message:
                          type: string
                        id:
                          type: string
                        timestamp:
                          type: string
                          format: date-time
                        liked:
                          type: boolean
        "500":
          description: Server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
  /api/followers:
    get:
      summary: Get followers
      description: Retrieve the list of followers.
      parameters:
        - name: userAddress
          in: query
          required: true
          description: The address of the user whose followers are being retrieved.
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
          description: Successfully retrieved the list of followers.
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        address:
                          type: string
                          description: The address of the follower.
                        userAddress:
                          type: string
                          description: The address of the user being followed.
        "400":
          description: Invalid query parameter or missing required field.
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
  /api/followed:
    get:
      summary: Get followers
      description: Retrieve the list of followed.
      parameters:
        - name: address
          in: query
          required: true
          description: The address of the user whose followers are being retrieved.
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
          description: Successfully retrieved the list of followers.
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        address:
                          type: string
                          description: The address of the follower.
                        userAddress:
                          type: string
                          description: The address of the user being followed.
        "400":
          description: Invalid query parameter or missing required field.
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
  /api/userlikes:
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
                type: object
                properties:
                  total:
                    type: integer
                  data:
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
  /api/messagelikes:
    get:
      summary: Get likes for a message
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
                type: object
                properties:
                  total:
                    type: integer
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        address:
                          type: string
                        id:
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

  /isfollowed:
    get:
      summary: Check if a user is following another user
      description: Checks if a document exists in the "followers" collection where "address" and "userAddress" match the query parameters.
      parameters:
        - name: address
          in: query
          required: true
          description: The address of the user following the entity.
          schema:
            type: string
        - name: userAddress
          in: query
          required: true
          description: The address of the entity being followed.
          schema:
            type: string
      responses:
        200:
          description: Follower status response
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: boolean
                    description: Whether the user is following the specified address.
                    example: true
        500:
          description: Internal Server Error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    description: The error message.
                    example: "Internal server error"

  /isliked:
    get:
      summary: Check if a user is liking another user
      description: Checks if a document exists in the "likes" collection where "address" and "userAddress" match the query parameters.
      parameters:
        - name: address
          in: query
          required: true
          description: The address of the user liking the entity.
          schema:
            type: string
        - name: userAddress
          in: query
          required: true
          description: The address of the entity beingliked.
          schema:
            type: string
      responses:
        200:
          description: Like status response
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: boolean
                    description: Whether the user isliking the specified address.
                    example: true
        500:
          description: Internal Server Error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    description: The error message.
                    example: "Internal server error"

`;
