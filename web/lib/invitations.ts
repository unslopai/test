import * as crypto from 'crypto';

/**
 * Invitation status types.
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

/**
 * Represents an invitation record in the database.
 */
export interface Invitation {
  id: string;
  email: string;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  invitedByUserId: string;
}

/**
 * Interface for the Email Service provider.
 */
export interface EmailService {
  sendEmail(to: string, subject: string, htmlBody: string): Promise<void>;
}

/**
 * In-memory database mock for demonstration purposes.
 * In a real application, replace this with Prisma, TypeORM, Mongoose, etc.
 */
export class InMemoryInvitationDatabase {
  private invitations: Map<string, Invitation> = new Map();

  async save(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
  }

  async findByToken(token: string): Promise<Invitation | null> {
    for (const invitation of this.invitations.values()) {
      if (invitation.token === token) {
        return invitation;
      }
    }
    return null;
  }

  async update(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
  }
}

/**
 * Configuration options for the InvitationService.
 */
export interface InvitationServiceOptions {
  db: InMemoryInvitationDatabase;
  emailService: EmailService;
  appBaseUrl: string; // e.g., 'https://myapp.com'
  expirationHours?: number; // Default: 48 hours
}

/**
 * Service handling the full lifecycle of app invitations.
 */
export class InvitationService {
  private db: InMemoryInvitationDatabase;
  private emailService: EmailService;
  private appBaseUrl: string;
  private expirationMs: number;

  constructor(options: InvitationServiceOptions) {
    this.db = options.db;
    this.emailService = options.emailService;
    this.appBaseUrl = options.appBaseUrl;
    const hours = options.expirationHours ?? 48;
    this.expirationMs = hours * 60 * 60 * 1000;
  }

  /**
   * Step 1 & 2: Create an invitation and send the email containing the link.
   */
  async createAndSendInvitation(email: string, invitedByUserId: string): Promise<Invitation> {
    // Basic email validation
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address provided.');
    }

    const id = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expirationMs);

    const invitation: Invitation = {
      id,
      email: email.toLowerCase().trim(),
      token,
      status: 'pending',
      expiresAt,
      createdAt: now,
      invitedByUserId,
    };

    // Save to database
    await this.db.save(invitation);

    // Send email
    await this.sendInvitationEmail(invitation);

    return invitation;
  }

  /**
   * Step 3: Accept an invitation using the token provided in the link.
   */
  async acceptInvitation(token: string): Promise<Invitation> {
    if (!token) {
      throw new Error('Invitation token is required.');
    }

    const invitation = await this.db.findByToken(token);

    if (!invitation) {
      throw new Error('Invalid invitation token.');
    }

    if (invitation.status === 'accepted') {
      throw new Error('This invitation has already been accepted.');
    }

    if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await this.db.update(invitation);
      throw new Error('This invitation has expired.');
    }

    // Mark as accepted
    invitation.status = 'accepted';
    await this.db.update(invitation);

    // TODO: Trigger post-acceptance logic here (e.g., add user to organization, create account)

    return invitation;
  }

  /**
   * Helper method to compose and send the email.
   */
  private async sendInvitationEmail(invitation: Invitation): Promise<void> {
    const inviteLink = `${this.appBaseUrl}/accept-invite?token=${invitation.token}`;
    const subject = 'You have been invited to join the app!';
    const htmlBody = `
      <p>Hello,</p>
      <p>You have been invited to join our application.</p>
      <p>Click the link below to accept your invitation:</p>
      <a href="${inviteLink}">${inviteLink}</a>
      <p>This link will expire in 48 hours.</p>
    `;

    await this.emailService.sendEmail(invitation.email, subject, htmlBody);
  }
}

// ==========================================
// EXAMPLE USAGE (Console Email Service)
// ==========================================

class ConsoleEmailService implements EmailService {
  async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    console.log(`\n--- [EMAIL SENT] ---`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${htmlBody}`);
    console.log(`--------------------\n`);
  }
}

async function runDemo() {
  const db = new InMemoryInvitationDatabase();
  const emailService = new ConsoleEmailService();
  
  const invitationService = new InvitationService({
    db,
    emailService,
    appBaseUrl: 'https://myapp.com',
  });

  try {
    console.log('1. Creating and sending invitation...');
    const newInvite = await invitationService.createAndSendInvitation(
      'friend@example.com',
      'user_123'
    );
    console.log(`Invitation created with ID: ${newInvite.id}`);

    console.log('2. Simulating user clicking the link and accepting...');
    const acceptedInvite = await invitationService.acceptInvitation(newInvite.token);
    console.log(`Success! Invitation for ${acceptedInvite.email} status is now: ${acceptedInvite.status}`);

    // Try using the same token again (should fail)
    console.log('3. Trying to reuse the same token...');
    await invitationService.acceptInvitation(newInvite.token);
  } catch (error: any) {
    console.error('Error caught in demo:', error.message);
  }
}

// Uncomment to run the demo locally with `ts-node invitations.ts`
// runDemo();
