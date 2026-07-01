const db = require('./index');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const API_URL = process.env.API_URL;
if (!API_URL) {
  throw new Error('API_URL environment variable is required');
}

// Mailer configuration using SMTP settings from backend/.env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;

// Send email helper
async function sendAuthEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"AssessmentXP Auth" <${emailFrom}>`,
      to,
      subject,
      html,
    });
    console.log('[nodemailer] Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('[nodemailer] Failed to send email:', error);
    throw error;
  }
}

// Convert PostgreSQL row to Supabase User format
function pgUserToSupabaseUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    app_metadata: row.raw_app_meta_data || {},
    user_metadata: row.raw_user_meta_data || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Helper to prepare parameters for PostgreSQL queries (handles JSON/JSONB serialization)
function prepareParam(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (val instanceof Date) return val;
    if (Buffer.isBuffer(val)) return val;
    if (Array.isArray(val)) {
      // If it is an array of objects, serialize to JSON string for JSONB column
      if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null && !(val[0] instanceof Date) && !Buffer.isBuffer(val[0])) {
        return JSON.stringify(val);
      }
      // Keep primitives arrays intact for native Postgres array types (e.g. TEXT[])
      return val;
    }
    // Serialise non-array objects ({}) to JSON string
    return JSON.stringify(val);
  }
  return val;
}

// Helper to generate a 6-digit OTP code
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to generate tokens
function generateToken() {
  return require('crypto').randomBytes(24).toString('hex');
}

// SQL Query Builder
class PostgresSupabaseQueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = 'select'; // select, insert, update, delete
    this.columns = '*';
    this.whereConditions = [];
    this.orConditions = [];
    this.orderCol = null;
    this.orderAsc = true;
    this.limitVal = null;
    this.dataToSave = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.params = [];
  }

  select(columns = '*') {
    if (this.action !== 'insert' && this.action !== 'update' && this.action !== 'delete') {
      this.action = 'select';
    }
    this.columns = columns;
    return this;
  }

  insert(data) {
    this.action = 'insert';
    this.dataToSave = data;
    return this;
  }

  update(data) {
    this.action = 'update';
    this.dataToSave = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(col, val) {
    this.whereConditions.push({ col, val });
    return this;
  }

  or(expr) {
    // Parse expression e.g. "slug.eq.val,domain.eq.val"
    const parts = expr.split(',');
    for (const part of parts) {
      const match = part.match(/^([^.]+)\.eq\.(.+)$/);
      if (match) {
        this.orConditions.push({ col: match[1], val: match[2] });
      }
    }
    return this;
  }

  order(col, { ascending = true } = {}) {
    this.orderCol = col;
    this.orderAsc = ascending;
    return this;
  }

  limit(val) {
    this.limitVal = val;
    return this;
  }

  match(obj) {
    if (obj) {
      for (const [key, val] of Object.entries(obj)) {
        if (val !== undefined && val !== null) {
          this.eq(key, val);
        }
      }
    }
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute() {
    let sql = '';
    const params = [];

    // Helper to get parameter index
    const addParam = (val) => {
      params.push(prepareParam(val));
      return `$${params.length}`;
    };

    if (this.action === 'select') {
      sql = `SELECT ${this.columns} FROM ${this.table}`;
    } else if (this.action === 'insert') {
      const isArray = Array.isArray(this.dataToSave);
      const rowsToInsert = isArray ? this.dataToSave : [this.dataToSave];
      
      if (rowsToInsert.length === 0) {
        return { data: [], error: null };
      }

      const keys = Object.keys(rowsToInsert[0]);
      const cols = keys.map(k => `"${k}"`).join(', ');
      
      const valPlaceholders = [];
      for (const row of rowsToInsert) {
        const rowPlaceholders = keys.map(k => addParam(row[k]));
        valPlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      }
      
      sql = `INSERT INTO ${this.table} (${cols}) VALUES ${valPlaceholders.join(', ')} RETURNING *`;
    } else if (this.action === 'update') {
      const keys = Object.keys(this.dataToSave);
      const sets = keys.map(k => `"${k}" = ${addParam(this.dataToSave[k])}`).join(', ');
      sql = `UPDATE ${this.table} SET ${sets}`;
    } else if (this.action === 'delete') {
      sql = `DELETE FROM ${this.table}`;
    }

    // Build WHERE clause
    const wheres = [];
    for (const cond of this.whereConditions) {
      wheres.push(`"${cond.col}" = ${addParam(cond.val)}`);
    }

    // Build OR clause
    if (this.orConditions.length > 0) {
      const ors = this.orConditions.map(cond => `"${cond.col}" = ${addParam(cond.val)}`);
      wheres.push(`(${ors.join(' OR ')})`);
    }

    if (wheres.length > 0) {
      sql += ` WHERE ${wheres.join(' AND ')}`;
    }

    // Return update/delete results
    if (this.action === 'update' || this.action === 'delete') {
      sql += ' RETURNING *';
    }

    // Build ORDER BY clause
    if (this.orderCol) {
      sql += ` ORDER BY "${this.orderCol}" ${this.orderAsc ? 'ASC' : 'DESC'}`;
    }

    // Build LIMIT clause
    if (this.limitVal !== null) {
      sql += ` LIMIT ${parseInt(this.limitVal, 10)}`;
    }

    try {
      console.log('[postgresSupabaseShim] Executing SQL:', sql, 'Params:', params);
      const result = await db.query(sql, params);
      let data = result.rows;
      console.log('[postgresSupabaseShim] Query successful. Row count:', data.length);

      if (this.isSingle) {
        if (data.length === 0) {
          throw new Error('JSON object requested, but no rows returned');
        }
        data = data[0];
      } else if (this.isMaybeSingle) {
        data = data.length > 0 ? data[0] : null;
      }

      // If returning user rows from auth.users, format them properly
      if (this.table === 'auth.users') {
        if (Array.isArray(data)) {
          data = data.map(pgUserToSupabaseUser);
        } else if (data) {
          data = pgUserToSupabaseUser(data);
        }
      }

      return { data, error: null };
    } catch (err) {
      console.error('[postgres query error]:', err.message, 'SQL:', sql);
      return { data: null, error: err };
    }
  }

  // Allow use with await directly (thenable)
  async then(onfulfilled, onrejected) {
    try {
      const res = await this.execute();
      return onfulfilled(res);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }
}

// Custom Auth Module
const auth = {
  // Sign Up a user
  signUp: async ({ email, password, options }) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 15 * 60000); // 15 minutes
      
      const appMetadata = options?.data?.app_metadata || options?.data || {};
      const userMetadata = options?.data || {};
      
      // Check if user already exists
      const existing = await db.query('SELECT * FROM auth.users WHERE email = $1', [normalizedEmail]);
      if (existing.rows.length > 0) {
        return { data: null, error: { message: 'User already registered' } };
      }

      // Insert new user into auth.users
      const res = await db.query(
        `INSERT INTO auth.users (email, password_hash, is_verified, verification_token, verification_token_expires, raw_app_meta_data, raw_user_meta_data)
         VALUES ($1, $2, false, $3, $4, $5, $6) RETURNING *`,
        [normalizedEmail, passwordHash, otp, otpExpires, JSON.stringify(appMetadata), JSON.stringify(userMetadata)]
      );

      const user = pgUserToSupabaseUser(res.rows[0]);

      // Send verification email with OTP code
      const html = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #002147;">Confirm your registration</h2>
          <p>Thank you for signing up to AssessmentXP. Please enter the following 6-digit verification code to complete your signup:</p>
          <div style="font-size: 24px; font-weight: bold; background: #f4f6f8; padding: 15px; text-align: center; border-radius: 4px; letter-spacing: 5px; margin: 20px 0; color: #002147;">
            ${otp}
          </div>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `;
      await sendAuthEmail(normalizedEmail, 'Confirm your AssessmentXP registration', html);

      return { data: { user, session: null }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Sign In with email and password
  signInWithPassword: async ({ email, password }) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const res = await db.query('SELECT * FROM auth.users WHERE email = $1', [normalizedEmail]);
      
      if (res.rows.length === 0) {
        return { data: null, error: { message: 'Invalid login credentials' } };
      }

      const row = res.rows[0];

      if (!row.password_hash) {
        return { data: null, error: { message: 'Account requires password setup' } };
      }

      const match = await bcrypt.compare(password, row.password_hash);
      if (!match) {
        return { data: null, error: { message: 'Invalid login credentials' } };
      }

      if (!row.is_verified) {
        return { data: null, error: { message: 'Email not confirmed' } };
      }

      const user = pgUserToSupabaseUser(row);
      
      // Generate JWT
      const token = jwt.sign(
        {
          sub: user.id,
          id: user.id,
          email: user.email,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        data: {
          user,
          session: {
            access_token: token,
            refresh_token: 'local-refresh-token',
            user,
          },
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Verify OTP/Code (verification link/OTP verification)
  verifyOtp: async ({ email, token, type }) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const res = await db.query(
        'SELECT * FROM auth.users WHERE email = $1 AND verification_token = $2 AND verification_token_expires > now()',
        [normalizedEmail, token]
      );

      if (res.rows.length === 0) {
        return { data: null, error: { message: 'Invalid or expired verification code' } };
      }

      const row = res.rows[0];

      // Mark verified
      await db.query(
        'UPDATE auth.users SET is_verified = true, verification_token = null, verification_token_expires = null WHERE id = $1',
        [row.id]
      );

      const user = pgUserToSupabaseUser({ ...row, is_verified: true });

      // Generate session JWT
      const jwtToken = jwt.sign(
        {
          sub: user.id,
          id: user.id,
          email: user.email,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        data: {
          user,
          session: {
            access_token: jwtToken,
            refresh_token: 'local-refresh-token',
            user,
          },
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Resend OTP Code
  resend: async ({ type, email }) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 15 * 60000);

      const res = await db.query(
        'UPDATE auth.users SET verification_token = $1, verification_token_expires = $2 WHERE email = $3 RETURNING *',
        [otp, otpExpires, normalizedEmail]
      );

      if (res.rows.length === 0) {
        return { data: null, error: { message: 'Email address not found' } };
      }

      // Send email
      const html = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #002147;">Confirm your registration</h2>
          <p>Please enter the following verification code to complete your registration:</p>
          <div style="font-size: 24px; font-weight: bold; background: #f4f6f8; padding: 15px; text-align: center; border-radius: 4px; letter-spacing: 5px; margin: 20px 0; color: #002147;">
            ${otp}
          </div>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `;
      await sendAuthEmail(normalizedEmail, 'Your AssessmentXP registration code', html);

      return { data: {}, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Reset password request (Send link)
  resetPasswordForEmail: async (email, { redirectTo }) => {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const resetToken = generateToken();
      const expires = new Date(Date.now() + 60 * 60000); // 1 hour

      const res = await db.query(
        'UPDATE auth.users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING *',
        [resetToken, expires, normalizedEmail]
      );

      if (res.rows.length > 0) {
        // Build link: e.g. https://yourfrontend.com/reset-password?token=XYZ
        const link = `${redirectTo}?token=${resetToken}`;
        const html = `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #002147;">Reset Your Password</h2>
            <p>You requested a password reset for your AssessmentXP account. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${link}" style="background-color: #002147; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;"><a href="${link}">${link}</a></p>
            <p>This link will expire in 1 hour.</p>
          </div>
        `;
        await sendAuthEmail(normalizedEmail, 'Reset your AssessmentXP password', html);
      }

      return { data: {}, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Reset Password using token OR update password for current user
  updateUser: async ({ password }, token) => {
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      let queryRes;

      if (token) {
        // Reset password via reset token
        queryRes = await db.query(
          'UPDATE auth.users SET password_hash = $1, reset_token = null, reset_token_expires = null, is_verified = true WHERE reset_token = $2 AND reset_token_expires > now() RETURNING *',
          [passwordHash, token]
        );
      } else {
        return { data: null, error: { message: 'Token is required to reset password' } };
      }

      if (queryRes.rows.length === 0) {
        return { data: null, error: { message: 'Invalid or expired password reset token' } };
      }

      const user = pgUserToSupabaseUser(queryRes.rows[0]);
      return { data: { user }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  signOut: async () => {
    return { error: null };
  },

  // Helper method to retrieve user profile by token
  getUser: async (token) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const res = await db.query('SELECT * FROM auth.users WHERE id = $1', [payload.sub]);
      
      if (res.rows.length === 0) {
        return { data: { user: null }, error: { message: 'User not found' } };
      }

      const user = pgUserToSupabaseUser(res.rows[0]);
      return { data: { user }, error: null };
    } catch (err) {
      return { data: { user: null }, error: err };
    }
  },

  // Admin APIs
  admin: {
    inviteUserByEmail: async (email, { redirectTo, data }) => {
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const resetToken = generateToken();
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60000); // 7 days
        
        const appMetadata = data?.app_metadata || data || {};
        const userMetadata = data?.user_metadata || data || {};

        // Check if user exists
        let user;
        const existing = await db.query('SELECT * FROM auth.users WHERE email = $1', [normalizedEmail]);
        
        if (existing.rows.length > 0) {
          user = pgUserToSupabaseUser(existing.rows[0]);
          // Just update metadata and reset token to trigger link
          await db.query(
            'UPDATE auth.users SET reset_token = $1, reset_token_expires = $2, raw_app_meta_data = $3 WHERE id = $4',
            [resetToken, expires, JSON.stringify({ ...user.app_metadata, ...appMetadata }), user.id]
          );
        } else {
          // Create new unverified user with invite reset token
          const res = await db.query(
            `INSERT INTO auth.users (email, is_verified, reset_token, reset_token_expires, raw_app_meta_data, raw_user_meta_data)
             VALUES ($1, false, $2, $3, $4, $5) RETURNING *`,
            [normalizedEmail, resetToken, expires, JSON.stringify(appMetadata), JSON.stringify(userMetadata)]
          );
          user = pgUserToSupabaseUser(res.rows[0]);
        }

        // Send invitation email
        const link = `${redirectTo}?token=${resetToken}`;
        const html = `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #002147;">Invitation to join AssessmentXP</h2>
            <p>You have been invited to join AssessmentXP. Click the link below to set up your account and password:</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${link}" style="background-color: #002147; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Accept Invitation</a>
            </div>
            <p>Or paste this link in your browser:</p>
            <p style="word-break: break-all;"><a href="${link}">${link}</a></p>
          </div>
        `;
        await sendAuthEmail(normalizedEmail, 'You are invited to join AssessmentXP', html);

        return { data: { user }, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },

    listUsers: async () => {
      try {
        const res = await db.query('SELECT * FROM auth.users ORDER BY created_at DESC');
        const users = res.rows.map(pgUserToSupabaseUser);
        return { data: { users }, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },

    updateUserById: async (id, { password, app_metadata, user_metadata }) => {
      try {
        const updates = [];
        const params = [id];

        const addUpdate = (col, val) => {
          params.push(val);
          updates.push(`"${col}" = $${params.length}`);
        };

        if (password) {
          const hash = await bcrypt.hash(password, 10);
          addUpdate('password_hash', hash);
        }
        if (app_metadata) {
          addUpdate('raw_app_meta_data', JSON.stringify(app_metadata));
        }
        if (user_metadata) {
          addUpdate('raw_user_meta_data', JSON.stringify(user_metadata));
        }

        if (updates.length === 0) {
          const current = await db.query('SELECT * FROM auth.users WHERE id = $1', [id]);
          return { data: { user: pgUserToSupabaseUser(current.rows[0]) }, error: null };
        }

        const sql = `UPDATE auth.users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const res = await db.query(sql, params);
        
        if (res.rows.length === 0) {
          return { data: null, error: { message: 'User not found' } };
        }

        const user = pgUserToSupabaseUser(res.rows[0]);
        return { data: { user }, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },

    generateLink: async ({ type, email, options }) => {
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const resetToken = generateToken();
        const expires = new Date(Date.now() + 24 * 60 * 60000); // 24 hours
        
        const res = await db.query(
          'UPDATE auth.users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING *',
          [resetToken, expires, normalizedEmail]
        );

        if (res.rows.length === 0) {
          return { data: null, error: { message: 'User not found' } };
        }

        const redirectTo = options?.redirectTo || (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/reset-password` : `${API_URL}/reset-password`);
        const link = `${redirectTo}?token=${resetToken}`;

        // Automatically trigger invite email if type is recovery/invite
        if (type === 'recovery' || type === 'invite') {
          const html = `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #002147;">Accept Your Invitation / Reset Password</h2>
              <p>Please click the button below to configure your account credentials:</p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${link}" style="background-color: #002147; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Configure Account</a>
              </div>
            </div>
          `;
          await sendAuthEmail(normalizedEmail, 'Set up your AssessmentXP account credentials', html);
        }

        return { data: { properties: { action_link: link } }, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },

    createUser: async ({ email, password, email_confirm, app_metadata, user_metadata }) => {
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const hash = password ? await bcrypt.hash(password, 10) : null;
        
        const res = await db.query(
          `INSERT INTO auth.users (email, password_hash, is_verified, raw_app_meta_data, raw_user_meta_data)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [normalizedEmail, hash, email_confirm || false, JSON.stringify(app_metadata || {}), JSON.stringify(user_metadata || {})]
        );

        const user = pgUserToSupabaseUser(res.rows[0]);
        return { data: { user }, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },
  },
};

// Storage Module
const storage = {
  from: (bucketName) => {
    const uploadDir = path.join(__dirname, '../../public/uploads', bucketName);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    return {
      upload: async (filePath, fileBody, options) => {
        try {
          const fullPath = path.join(uploadDir, filePath);
          
          // Ensure nested folders in path exist
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          let buffer = fileBody;
          // If body is base64 string, convert it
          if (typeof fileBody === 'string' && fileBody.includes(';base64,')) {
            const base64Data = fileBody.split(';base64,')[1];
            buffer = Buffer.from(base64Data, 'base64');
          } else if (typeof fileBody === 'string') {
            buffer = Buffer.from(fileBody, 'utf8');
          }

          fs.writeFileSync(fullPath, buffer);
          console.log('[storage] Saved file locally:', fullPath);
          return { data: { path: filePath }, error: null };
        } catch (err) {
          console.error('[storage upload error]:', err);
          return { data: null, error: err };
        }
      },

      getPublicUrl: (filePath) => {
        const publicUrl = `${API_URL}/uploads/${bucketName}/${filePath}`;
        return { data: { publicUrl } };
      },
    };
  },
};

module.exports = {
  createClient: () => ({
    from: (table) => new PostgresSupabaseQueryBuilder(table),
    auth,
    storage,
  }),
  // Support direct object exports
  from: (table) => new PostgresSupabaseQueryBuilder(table),
  auth,
  storage,
};
