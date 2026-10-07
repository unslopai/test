import * as nodemailer from 'nodemailer';

interface Invitation {
  id: string;
  email: string;
  accepted: boolean;
}

class InvitationsService {
  private invitations: Invitation[] = [];

  public createInvitation(email: string): Invitation {
    const id = this.generateId();
    const invitation = { id, email, accepted: false };
    this.invitations.push(invitation);
    return invitation;
  }

  public sendInvitation(invitation: Invitation): void {
    const transporter = nodemailer.createTransport({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'user@example.com',
        pass: 'password',
      },
    });

    const mailOptions = {
      from: 'invitations@yourapp.com',
      to: invitation.email,
      subject: 'Invitation to join our app',
      text: `Hello ${invitation.email}, you have been invited to join our app. 
              Please click the following link to accept your invitation:
              http://example.com/accept-invitation?id=${invitation.id}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
      } else {
        console.log(`Invitation sent to ${mailOptions.to}`);
      }
    });
  }

  public acceptInvitation(id: string): Invitation | null {
    const invitation = this.invitations.find((i) => i.id === id);

    if (invitation) {
      invitation.accepted = true;
      return invitation;
    } else {
      return null;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}

export default InvitationsService;
