import crypto from 'crypto';
import nodemailer from 'nodemailer';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

export interface ResetTokenRecord {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
}

export interface PasswordResetConfig {
  emailTransport: nodemailer.Transporter;
  senderEmail: string;
  clientResetUrl: string; // e.g., 'https://mywebsite.com/reset-password'
  tokenExpirationMinutes?: number;
}

// ==========================================
// 2. MOCK DATABASE (Replace with your ORM)
// ==========================================

class MockDatabase {
  private tokens = new Map<string, ResetTokenRecord>();

  async saveToken(record: ResetTokenRecord): Promise<void> {
    // In SQL/NoSQL, you might want to invalidate/delete previous tokens for this user first
    this.tokens.set(record.userId, record);
  }

  async getTokenByUserId(userId: string): Promise<ResetTokenRecord | null> {
    return this.tokens.get(userId) || null;
  }

  async deleteToken(userId: string): Promise<void> {
    this.tokens.delete(userId);
  }
}

const db = new MockDatabase();

// ==========================================
// 3. PASSWORD RESET HELPER CLASS
// ==========================================

export class PasswordResetService {
  private transporter: nodemailer.Transporter;
  private senderEmail: string;
  private clientResetUrl: string;
  private expirationMinutes: number;

  constructor(config: PasswordResetConfig) {
    this.transporter = config.emailTransport;
    this.senderEmail = config.senderEmail;
    this.clientResetUrl = config.clientResetUrl;
    this.expirationMinutes = config.tokenExpirationMinutes || 15; // default 15 mins
  }

  /**
   * Step 1: Create a reset token and send it via email.
   * We return void (or don't throw) on user not found to prevent user enumeration attacks.
   */
  async requestPasswordReset(userId: string, userEmail: string): Promise<void> {
    // 1. Generate a secure random plain-text token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash the token before saving to the DB (Security Best Practice)
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // 3. Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.expirationMinutes);

    // 4. Save to Database
    await db.saveToken({
      userId,
      hashedToken,
      expiresAt,
    });

    // 5. Send Email containing the *raw* (unhashed) token
    const resetLink = `${this.clientResetUrl}?token=${rawToken}&userId=${userId}`;
    
    await this.transporter.sendMail({
      from: this.senderEmail,
      to: userEmail,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nThis link expires in ${this.expirationMinutes} minutes.`,
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link expires in ${this.expirationMinutes} minutes.</p>
      `,
    });
  }

  /**
   * Step 2: Verify the token provided by the user.
   * Returns the userId if valid, otherwise throws an error.
   */
  async verifyAndConsumeToken(userId: string, rawToken: string): Promise<boolean> {
    const record = await db.getTokenByUserId(userId);

    if (!record) {
      throw new Error('Invalid or expired password reset token.');
    }

    // Check if token is expired
    if (new Date() > record.expiresAt) {
      await db.deleteToken(userId); // Cleanup expired token
      throw new Error('Password reset token has expired.');
    }

    // Hash the incoming raw token to compare against the stored hash
    const hashedIncomingToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hashedIncomingToken, 'hex'),
      Buffer.from(record.hashedToken, 'hex')
    );

    if (!isValid) {
      throw new Error('Invalid or expired password reset token.');
    }

    // Token is valid! Consume it so it cannot be used again (Single-use)
    await db.deleteToken(userId);

    return true;
  }
}

// ==========================================
// 4. USAGE EXAMPLE
// ==========================================

async function runExample() {
  // Setup test SMTP transporter (using Ethereal for testing)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  // Initialize Service
  const passwordResetService = new PasswordResetService({
    emailTransport: transporter,
    senderEmail: '"Support" <support@example.com>',
    clientResetUrl: 'https://myapp.com/reset-password',
    tokenExpirationMinutes: 15,
  });

  const userId = 'user_123456';
  const userEmail = 'test@example.com';

  console.log('--- 1. Requesting Reset ---');
  await passwordResetService.requestPasswordReset(userId, userEmail);
  console.log('Password reset email sent!');

  // Simulate user clicking the link (extracting token & userId from URL)
  // In a real app, this happens in your API controller:
  const simulatedRawTokenFromUrl = '...'; // (In real life, this comes from the email link)

  try {
    console.log('--- 2. Checking Token ---');
    // For testing this script locally where we didn't capture the random token, 
    // you would normally pass the raw token extracted from the req.query.
    await passwordResetService.verifyAndConsumeToken(userId, 'some_raw_token');
  } catch (error: any) {
    console.log('Expected error during verification in this mock script:', error.message);
  }
}

// Uncomment to run the example
// runExample();
