import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Configuration for nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Your Gmail address
        pass: 'your-email-password'  // Your Gmail password or an app-specific password if two-factor authentication is enabled
    }
});

// Interface for storing token details in a database
interface PasswordResetToken {
    userId: string;
    token: string;
    expiresAt: Date;
}

class PasswordResetHelper {
    private tokens: { [key: string]: PasswordResetToken } = {};

    // Generate a password reset token
    public generateToken(userId: string): string {
        const token = crypto.randomBytes(20).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

        this.tokens[token] = { userId, token, expiresAt };
        return token;
    }

    // Send the reset token via email
    public async sendTokenEmail(email: string, token: string): Promise<void> {
        const mailOptions = {
            from: 'your-email@gmail.com', // Your Gmail address
            to: email,
            subject: 'Password Reset Request',
            text: `Please click on the following link to reset your password: http://example.com/reset?token=${token}`
        };

        await transporter.sendMail(mailOptions);
    }

    // Check if a token is valid and not expired
    public isValidToken(token: string): boolean {
        const tokenData = this.tokens[token];
        return !!tokenData && tokenData.expiresAt > new Date();
    }

    // Get the user ID associated with a valid token
    public getUserIdFromToken(token: string): string | null {
        if (this.isValidToken(token)) {
            return this.tokens[token].userId;
        }
        return null;
    }

    // Remove a token from the store after use or expiration
    public removeToken(token: string): void {
        delete this.tokens[token];
    }
}

export const passwordResetHelper = new PasswordResetHelper();
