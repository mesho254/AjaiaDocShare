export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Ajaia Docs API',
    version: '1.0.0',
    description:
      'REST API for **Ajaia Docs** — supporting rich-text document CRUD, `.txt`/`.md`/`.docx` file upload conversion, and role-based sharing (`owner`, `editor`, `viewer`).\n\nUse the **`x-user-id`** header parameter (defaults to `user-alice`) to simulate requests as any of the seeded team personas (`user-alice`, `user-liam`, `user-maya`).'
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server'
    }
  ],
  tags: [
    { name: 'System', description: 'Health check and service metadata' },
    { name: 'Users', description: 'Seeded team personas and active session resolution' },
    { name: 'Documents', description: 'Document creation, rich-text editing, and file upload' },
    { name: 'Sharing', description: 'Grant, update, and revoke role-based document access' }
  ],
  components: {
    parameters: {
      UserIdHeader: {
        name: 'x-user-id',
        in: 'header',
        required: false,
        description: 'Active seeded user ID performing the request (defaults to user-alice)',
        schema: {
          type: 'string',
          enum: ['user-alice', 'user-liam', 'user-maya'],
          default: 'user-alice'
        }
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'user-alice' },
          name: { type: 'string', example: 'Alice Rivera' },
          email: { type: 'string', example: 'alice@ajaia.io' },
          role_title: { type: 'string', example: 'Product Lead' },
          avatar_color: { type: 'string', example: '#4f46e5' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      ShareDetail: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'share-1' },
          document_id: { type: 'string', example: 'doc-roadmap' },
          user_id: { type: 'string', example: 'user-liam' },
          user_name: { type: 'string', example: 'Liam Chen' },
          user_email: { type: 'string', example: 'liam@ajaia.io' },
          avatar_color: { type: 'string', example: '#059669' },
          role: { type: 'string', enum: ['editor', 'viewer'], example: 'editor' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      DocumentWithAccess: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'doc-roadmap' },
          title: { type: 'string', example: 'Q4 Product Roadmap — AI Workspace' },
          content: {
            type: 'string',
            example: '<h1>Q4 Product Roadmap</h1><p>Rich text content...</p>'
          },
          owner_id: { type: 'string', example: 'user-alice' },
          owner_name: { type: 'string', example: 'Alice Rivera' },
          owner_email: { type: 'string', example: 'alice@ajaia.io' },
          owner_avatar_color: { type: 'string', example: '#4f46e5' },
          source_filename: { type: 'string', nullable: true, example: 'notes.md' },
          access_role: {
            type: 'string',
            enum: ['owner', 'editor', 'viewer'],
            example: 'owner'
          },
          shares: {
            type: 'array',
            items: { $ref: '#/components/schemas/ShareDetail' }
          },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'FORBIDDEN_DOCUMENT_ACCESS' },
              message: {
                type: 'string',
                example: 'You do not have permission to access this document.'
              }
            }
          }
        }
      }
    }
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check endpoint',
        responses: {
          '200': {
            description: 'Service is healthy'
          }
        }
      }
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List all seeded users and resolve current active persona',
        parameters: [{ $ref: '#/components/parameters/UserIdHeader' }],
        responses: {
          '200': {
            description: 'List of seeded users and active user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' }
                    },
                    currentUser: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List documents accessible to the active user (All, Owned, or Shared)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          {
            name: 'filter',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['all', 'owned', 'shared'],
              default: 'all'
            },
            description: 'Filter documents by ownership vs shared status'
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Case-insensitive search by document title or owner name'
          }
        ],
        responses: {
          '200': {
            description: 'Accessible documents list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    documents: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/DocumentWithAccess' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Documents'],
        summary: 'Create a new document',
        parameters: [{ $ref: '#/components/parameters/UserIdHeader' }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Product Strategy Memo' },
                  content: {
                    type: 'string',
                    example: '<h1>Strategy</h1><p>Initial rich-text draft.</p>'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created document',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    document: { $ref: '#/components/schemas/DocumentWithAccess' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/documents/upload': {
      post: {
        tags: ['Documents'],
        summary: 'Upload a .txt, .md, or .docx file and convert to rich-text HTML',
        parameters: [{ $ref: '#/components/parameters/UserIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload (.txt, .md, or .docx, max 5 MB)'
                  },
                  mode: {
                    type: 'string',
                    enum: ['create', 'extract'],
                    default: 'create',
                    description:
                      '"create" saves a new document; "extract" returns parsed HTML for importing into an existing draft'
                  },
                  title: {
                    type: 'string',
                    description: 'Optional custom title for the created document'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'File parsed and new document created'
          },
          '400': {
            description: 'Unsupported file type or file exceeds 5 MB limit',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/documents/{id}': {
      get: {
        tags: ['Documents'],
        summary: 'Get a single document by ID (requires Owner, Editor, or Viewer access)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'doc-roadmap' }
          }
        ],
        responses: {
          '200': {
            description: 'Document details with shares and effective access role'
          },
          '403': {
            description: 'User does not have access to this document'
          },
          '404': {
            description: 'Document not found'
          }
        }
      },
      patch: {
        tags: ['Documents'],
        summary: 'Update document title or rich-text content (Owner or Editor only)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'doc-roadmap' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Updated Document Title' },
                  content: {
                    type: 'string',
                    example: '<h1>Updated Heading</h1><p>Saved content.</p>'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Updated document' },
          '403': { description: 'Read-only viewer or unauthorized user' }
        }
      },
      delete: {
        tags: ['Documents'],
        summary: 'Delete a document permanently (Owner only)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'doc-roadmap' }
          }
        ],
        responses: {
          '200': { description: 'Document deleted' },
          '403': { description: 'Only the document owner can delete' }
        }
      }
    },
    '/api/documents/{id}/stream': {
      get: {
        tags: ['Documents'],
        summary: 'Real-time Server-Sent Events (SSE) stream for live collaborator edits and presence',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'doc-roadmap' }
          }
        ],
        responses: {
          '200': {
            description: 'EventStream emitting "presence" and "doc-update" events in real time'
          }
        }
      }
    },
    '/api/documents/{id}/versions': {
      get: {
        tags: ['Documents'],
        summary: 'List saved version history snapshots for a document',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'doc-roadmap' } }
        ],
        responses: { '200': { description: 'List of document version snapshots' } }
      },
      post: {
        tags: ['Documents'],
        summary: 'Save a named version snapshot (Owner or Editor)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'doc-roadmap' } }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { summary: { type: 'string', example: 'Ready for design review' } }
              }
            }
          }
        },
        responses: { '201': { description: 'Version snapshot created' } }
      }
    },
    '/api/documents/{id}/versions/{versionId}/restore': {
      post: {
        tags: ['Documents'],
        summary: 'Restore a document to a previous version snapshot (Owner or Editor)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'doc-roadmap' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Document restored and broadcast live' } }
      }
    },
    '/api/documents/{id}/comments': {
      get: {
        tags: ['Documents'],
        summary: 'List comments and suggestions on a document',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'doc-roadmap' } }
        ],
        responses: { '200': { description: 'List of comments and suggestions' } }
      },
      post: {
        tags: ['Documents'],
        summary: 'Create a comment or suggestion (Owner, Editor, or Viewer)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'doc-roadmap' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  type: { type: 'string', enum: ['comment', 'suggestion'], default: 'comment' },
                  quoted_text: { type: 'string', example: 'Core Milestones' },
                  content: { type: 'string', example: 'Key Q4 Milestones' }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Comment or suggestion created' } }
      }
    },
    '/api/documents/{id}/shares': {
      post: {
        tags: ['Sharing'],
        summary: 'Share a document with another user or update their role (Owner only)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'doc-roadmap' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'role'],
                properties: {
                  email: {
                    type: 'string',
                    example: 'liam@ajaia.io',
                    description: 'Email of the user to grant access to'
                  },
                  role: {
                    type: 'string',
                    enum: ['editor', 'viewer'],
                    default: 'editor'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Access granted or updated' },
          '403': { description: 'Only the document owner can share' },
          '404': { description: 'Target user email not found' }
        }
      }
    },
    '/api/documents/{id}/shares/{shareId}': {
      delete: {
        tags: ['Sharing'],
        summary: 'Revoke a collaborator share (Owner only)',
        parameters: [
          { $ref: '#/components/parameters/UserIdHeader' },
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'doc-roadmap' }
          },
          {
            name: 'shareId',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'share-1' }
          }
        ],
        responses: {
          '200': { description: 'Share revoked' },
          '403': { description: 'Only the document owner can revoke access' }
        }
      }
    }
  }
};
