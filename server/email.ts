import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    console.error('Resend: X_REPLIT_TOKEN not found');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  console.log('Resend: Fetching credentials from connector...');
  
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    console.error('Resend: Connection not found or no API key', connectionSettings);
    throw new Error('Resend not connected');
  }
  
  console.log('Resend: Credentials loaded, from_email:', connectionSettings.settings.from_email);
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

// Helper function to get the base URL for email links
// Always use the custom production domain for emails since that's the public-facing URL
function getBaseUrl(): string {
  // Always prefer the custom production domain for emails
  return 'https://voxpopulous.fr';
}

const HERO_IMAGES = [
  'stock_images/french_town_hall_bui_35a06392.jpg',
  'stock_images/french_town_hall_bui_be513a77.jpg',
  'stock_images/french_town_hall_bui_683abf54.jpg',
  'stock_images/citizens_community_m_ff005690.jpg',
  'stock_images/citizens_community_m_ec0bd397.jpg',
];

function getRandomHeroImage(): string {
  const baseUrl = getBaseUrl();
  const randomImage = HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)];
  // Use /email-assets/ path which is served from client/public in production
  return `${baseUrl}/email-assets/${randomImage}`;
}

function getLogoUrl(): string {
  const baseUrl = getBaseUrl();
  // Use /email-assets/ path which is served from client/public in production
  return `${baseUrl}/email-assets/logo_voxpopulous_1765723835159.png`;
}

export function wrapEmailContent(content: string, options?: { 
  title?: string;
  showHeroImage?: boolean;
}): string {
  const logoUrl = getLogoUrl();
  const heroImageUrl = getRandomHeroImage();
  const showHero = options?.showHeroImage !== false;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options?.title || 'Voxpopulous'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <img src="${logoUrl}" alt="Voxpopulous" width="180" style="display: block; max-width: 180px; height: auto;" />
            </td>
          </tr>
          
          ${showHero ? `
          <!-- Hero Image -->
          <tr>
            <td style="padding: 0;">
              <img src="${heroImageUrl}" alt="Voxpopulous" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border-radius: 12px 12px 0 0;" />
            </td>
          </tr>
          ` : ''}
          
          <!-- Main Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 40px; ${showHero ? 'border-radius: 0 0 12px 12px;' : 'border-radius: 12px;'} box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 20px;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">
                Voxpopulous - La plateforme de participation citoyenne
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                <a href="${getBaseUrl()}" style="color: #3b82f6; text-decoration: none;">voxpopulous.fr</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Generic email sending function
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    console.log(`Email sent to ${options.to}: ${options.subject}`);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function sendIdeaStatusEmail(
  recipientEmail: string,
  ideaTitle: string,
  newStatus: string,
  tenantName: string,
  trackingUrl: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const statusConfig: Record<string, { label: string; color: string; bg: string; symbol: string }> = {
      NEW: { label: "Nouvelle", color: "#3b82f6", bg: "#eff6ff", symbol: "N" },
      UNDER_REVIEW: { label: "En cours d'examen", color: "#8b5cf6", bg: "#f5f3ff", symbol: "?" },
      IN_PROGRESS: { label: "En cours de réalisation", color: "#f59e0b", bg: "#fef3c7", symbol: "..." },
      DONE: { label: "Réalisée", color: "#10b981", bg: "#ecfdf5", symbol: "OK" },
      REJECTED: { label: "Rejetée", color: "#ef4444", bg: "#fef2f2", symbol: "X" }
    };
    
    const config = statusConfig[newStatus] || { label: newStatus, color: "#64748b", bg: "#f8fafc", symbol: "?" };

    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; margin-bottom: 12px;">
          <span style="display: inline-block; line-height: 56px; color: white; font-size: 24px; font-weight: bold;">i</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Mise à jour de votre idée</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">Votre proposition a été traitée</p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour,</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Le statut de votre idée <strong style="color: #1e293b;">"${ideaTitle}"</strong> a été mis à jour.
      </p>
      
      <div style="background: ${config.bg}; border: 1px solid ${config.color}; padding: 20px; margin: 24px 0; border-radius: 12px; text-align: center;">
        <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; background: ${config.color}; color: white; border-radius: 50%; font-size: 18px; font-weight: bold; margin-bottom: 8px;">${config.symbol}</span>
        <p style="color: ${config.color}; margin: 0; font-size: 20px; font-weight: 700;">${config.label}</p>
      </div>
      
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${trackingUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">Voir le détail de mon idée</a>
      </p>
      
      <p style="color: #64748b; line-height: 1.6; margin: 24px 0 0 0; font-size: 14px; text-align: center;">
        Cordialement,<br/>L'équipe ${tenantName}
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `[${tenantName}] Votre idée : ${config.label}`,
      html: wrapEmailContent(content, { title: 'Mise à jour de votre idée' })
    });

    console.log(`Email sent to ${recipientEmail} for idea status update`);
    return true;
  } catch (error) {
    console.error('Failed to send idea status email:', error);
    return false;
  }
}

export async function sendIncidentStatusEmail(
  recipientEmail: string,
  incidentTitle: string,
  newStatus: string,
  tenantName: string,
  trackingUrl: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const statusConfig: Record<string, { label: string; color: string; bg: string; symbol: string }> = {
      NEW: { label: "Nouveau", color: "#f59e0b", bg: "#fef3c7", symbol: "!" },
      ACKNOWLEDGED: { label: "Pris en compte", color: "#8b5cf6", bg: "#f5f3ff", symbol: "..." },
      IN_PROGRESS: { label: "En cours de traitement", color: "#3b82f6", bg: "#eff6ff", symbol: ">" },
      RESOLVED: { label: "Résolu", color: "#10b981", bg: "#ecfdf5", symbol: "OK" },
      REJECTED: { label: "Rejeté", color: "#ef4444", bg: "#fef2f2", symbol: "X" }
    };
    
    const config = statusConfig[newStatus] || { label: newStatus, color: "#64748b", bg: "#f8fafc", symbol: "?" };

    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; margin-bottom: 12px;">
          <span style="display: inline-block; line-height: 56px; color: white; font-size: 24px; font-weight: bold;">!</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Mise à jour de votre signalement</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">Votre signalement a été traité</p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour,</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Le statut de votre signalement <strong style="color: #1e293b;">"${incidentTitle}"</strong> a été mis à jour.
      </p>
      
      <div style="background: ${config.bg}; border: 1px solid ${config.color}; padding: 20px; margin: 24px 0; border-radius: 12px; text-align: center;">
        <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; background: ${config.color}; color: white; border-radius: 50%; font-size: 18px; font-weight: bold; margin-bottom: 8px;">${config.symbol}</span>
        <p style="color: ${config.color}; margin: 0; font-size: 20px; font-weight: 700;">${config.label}</p>
      </div>
      
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${trackingUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.3);">Voir le détail de mon signalement</a>
      </p>
      
      <p style="color: #64748b; line-height: 1.6; margin: 24px 0 0 0; font-size: 14px; text-align: center;">
        Cordialement,<br/>L'équipe ${tenantName}
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `[${tenantName}] Votre signalement : ${config.label}`,
      html: wrapEmailContent(content, { title: 'Mise à jour de votre signalement' })
    });

    console.log(`Email sent to ${recipientEmail} for incident status update`);
    return true;
  } catch (error) {
    console.error('Failed to send incident status email:', error);
    return false;
  }
}

export async function sendElectedOfficialNotificationEmail(
  recipientEmail: string,
  officialName: string,
  type: 'idea' | 'incident',
  title: string,
  description: string,
  category: string,
  tenantName: string,
  adminUrl: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const typeLabel = type === 'idea' ? 'idée citoyenne' : 'signalement';
    const typeTitle = type === 'idea' ? 'Nouvelle idée citoyenne' : 'Nouveau signalement';
    const accentColor = type === 'idea' ? '#3b82f6' : '#f59e0b';
    const iconBg = type === 'idea' 
      ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    const symbol = type === 'idea' ? 'i' : '!';

    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; background: ${iconBg}; border-radius: 12px; margin-bottom: 12px;">
          <span style="display: inline-block; line-height: 56px; color: white; font-size: 24px; font-weight: bold;">${symbol}</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">${typeTitle}</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">Dans votre domaine : <strong style="color: #1e293b;">${category}</strong></p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${officialName},</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Une nouvelle ${typeLabel} a été soumise dans votre domaine d'intervention et requiert votre attention.
      </p>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-left: 4px solid ${accentColor}; padding: 20px; margin: 24px 0; border-radius: 0 12px 12px 0;">
        <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 18px;">${title}</h3>
        <p style="color: #475569; margin: 0; line-height: 1.6; font-size: 14px;">${description.substring(0, 250)}${description.length > 250 ? '...' : ''}</p>
      </div>
      
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${adminUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">Consulter et traiter</a>
      </p>
      
      <p style="color: #64748b; line-height: 1.6; margin: 0; font-size: 14px; text-align: center;">
        Cordialement,<br/>L'équipe ${tenantName}
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `[${tenantName}] ${typeTitle} - ${category}`,
      html: wrapEmailContent(content, { title: typeTitle })
    });

    console.log(`Email sent to ${recipientEmail} for new ${type} notification`);
    return true;
  } catch (error) {
    console.error('Failed to send elected official notification email:', error);
    return false;
  }
}

export async function sendMeetingRegistrationEmail(
  recipientEmail: string,
  recipientName: string,
  meetingTitle: string,
  meetingDate: Date,
  meetingLocation: string,
  tenantName: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit'
    };
    const formattedDate = meetingDate.toLocaleDateString('fr-FR', dateOptions);
    const formattedTime = meetingDate.toLocaleTimeString('fr-FR', timeOptions);

    const content = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin-bottom: 16px;">
          <span style="display: inline-block; line-height: 64px; color: white; font-size: 28px; font-weight: bold;">OK</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Inscription confirmée</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">Votre place est réservée</p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${recipientName},</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Votre inscription à la réunion <strong style="color: #1e293b;">"${meetingTitle}"</strong> a bien été enregistrée.
      </p>
      
      <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; padding: 24px; margin: 24px 0; border-radius: 12px;">
        <h3 style="margin: 0 0 16px 0; color: #166534; font-size: 16px; font-weight: 600;">Détails de la réunion</h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; width: 24px; height: 24px; background: #10b981; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px; margin-right: 12px; vertical-align: middle; font-weight: bold;">D</span>
              <span style="color: #166534; font-weight: 500;">${formattedDate}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; width: 24px; height: 24px; background: #10b981; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px; margin-right: 12px; vertical-align: middle; font-weight: bold;">H</span>
              <span style="color: #166534; font-weight: 500;">${formattedTime}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; width: 24px; height: 24px; background: #10b981; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 12px; margin-right: 12px; vertical-align: middle; font-weight: bold;">L</span>
              <span style="color: #166534; font-weight: 500;">${meetingLocation}</span>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #1e40af; font-size: 14px; margin: 0;">
          <strong>Rappel :</strong> Pensez à noter cette date dans votre agenda. Nous avons hâte de vous y voir !
        </p>
      </div>
      
      <p style="color: #64748b; line-height: 1.6; margin: 24px 0 0 0; font-size: 14px; text-align: center;">
        Cordialement,<br/>L'équipe ${tenantName}
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `[${tenantName}] Inscription confirmée - ${meetingTitle}`,
      html: wrapEmailContent(content, { title: "Inscription confirmée" })
    });

    console.log(`Email sent to ${recipientEmail} for meeting registration`);
    return true;
  } catch (error) {
    console.error('Failed to send meeting registration email:', error);
    return false;
  }
}

export async function sendLeadMessageEmail(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  body: string,
  portalToken?: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    const baseUrl = getBaseUrl();
    const portalUrl = portalToken ? `${baseUrl}/p/${portalToken}` : null;

    const content = `
      <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Bonjour ${recipientName},</h2>
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <div style="color: #475569; line-height: 1.6; white-space: pre-wrap;">${body}</div>
      </div>
      ${portalUrl ? `
      <p style="margin: 0 0 24px 0; text-align: center;">
        <a href="${portalUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Repondre a ce message</a>
      </p>
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0;">
        Ou copiez ce lien : <a href="${portalUrl}" style="color: #3b82f6;">${portalUrl}</a>
      </p>
      ` : `
      <p style="color: #475569; line-height: 1.6; margin: 0;">
        Pour repondre a ce message, veuillez nous contacter directement.
      </p>
      `}
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `[Voxpopulous] ${subject}`,
      html: wrapEmailContent(content, { title: 'Message de Voxpopulous' })
    });

    console.log(`Lead message email sent to ${recipientEmail}: ${subject}`);
    return true;
  } catch (error) {
    console.error('Failed to send lead message email:', error);
    return false;
  }
}

export async function sendProspectQuoteEmail(
  recipientEmail: string,
  recipientName: string,
  organisationName: string,
  quoteNumber: string,
  totalEuros: number,
  validUntil: Date,
  quoteToken: string,
  portalToken: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const formattedTotal = totalEuros.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
    
    const validityDate = new Date(validUntil).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const baseUrl = getBaseUrl();
    const quoteUrl = `${baseUrl}/q/${quoteToken}`;
    const portalUrl = `${baseUrl}/p/${portalToken}`;

    const content = `
      <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Bonjour ${recipientName},</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Suite a votre demande pour <strong style="color: #1e293b;">${organisationName}</strong>, nous avons le plaisir 
        de vous transmettre notre proposition commerciale.
      </p>
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px;">Recapitulatif</h3>
        <p style="color: #475569; margin: 0 0 8px 0;"><strong>Devis n. :</strong> ${quoteNumber}</p>
        <p style="color: #475569; margin: 0 0 8px 0;"><strong>Montant TTC :</strong> ${formattedTotal}</p>
        <p style="color: #475569; margin: 0;"><strong>Valide jusqu'au :</strong> ${validityDate}</p>
      </div>
      <p style="margin: 0 0 24px 0; text-align: center;">
        <a href="${quoteUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Consulter et valider le devis</a>
      </p>
      <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #475569; margin: 0 0 8px 0; font-size: 14px;">
          <strong>Votre espace prospect :</strong> Vous pouvez egalement acceder a votre espace personnel 
          pour suivre votre dossier et echanger avec notre equipe.
        </p>
        <p style="margin: 0;">
          <a href="${portalUrl}" style="color: #3b82f6; text-decoration: underline;">Acceder a mon espace</a>
        </p>
      </div>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Votre devis ${quoteNumber} - Voxpopulous`,
      html: wrapEmailContent(content, { title: 'Votre devis' })
    });

    console.log(`Prospect quote email sent to ${recipientEmail}: ${quoteNumber}`);
    return true;
  } catch (error) {
    console.error('Failed to send prospect quote email:', error);
    return false;
  }
}

export async function sendLeadPortalLinkEmail(
  recipientEmail: string,
  recipientName: string,
  organisationName: string,
  portalToken: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    const baseUrl = getBaseUrl();
    const portalUrl = `${baseUrl}/p/${portalToken}`;

    const content = `
      <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Bonjour ${recipientName},</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Merci pour votre intérêt pour <strong style="color: #1e293b;">Voxpopulous</strong> pour <strong style="color: #1e293b;">${organisationName}</strong>.
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Nous avons créé un espace personnel dédié qui vous permet de :
      </p>
      <div style="background-color: #f8fafc; padding: 20px; margin: 24px 0; border-radius: 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; margin-right: 12px; vertical-align: middle;">1</span>
              <span style="color: #1e293b; font-weight: 500;">Échanger directement</span> <span style="color: #64748b;">avec notre équipe commerciale</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; margin-right: 12px; vertical-align: middle;">2</span>
              <span style="color: #1e293b; font-weight: 500;">Consulter vos devis</span> <span style="color: #64748b;">et les valider en ligne</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px; margin-right: 12px; vertical-align: middle;">3</span>
              <span style="color: #1e293b; font-weight: 500;">Suivre l'avancement</span> <span style="color: #64748b;">de votre dossier en temps réel</span>
            </td>
          </tr>
        </table>
      </div>
      <p style="margin: 0 0 24px 0; text-align: center;">
        <a href="${portalUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accéder à mon espace</a>
      </p>
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #1e40af; font-size: 14px; margin: 0;">
          <strong>Important :</strong> Conservez ce lien précieusement, il vous permettra d'accéder à votre espace à tout moment sans mot de passe.
        </p>
      </div>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Votre espace prospect - Voxpopulous`,
      html: wrapEmailContent(content, { title: 'Votre espace prospect' })
    });

    console.log(`Lead portal link email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send lead portal link email:', error);
    return false;
  }
}

export async function sendWelcomeEmail(
  recipientEmail: string,
  recipientName: string,
  organisationName: string,
  loginUrl: string,
  email: string,
  password: string
) {
  try {
    const { client, fromEmail } = await getResendClient();

    const content = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin-bottom: 16px;">
          <span style="display: inline-block; line-height: 64px; color: white; font-size: 28px; font-weight: bold;">OK</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 28px;">Bienvenue ${recipientName} !</h2>
        <p style="color: #64748b; margin: 0; font-size: 16px;">Votre compte administrateur est prêt</p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Votre espace <strong style="color: #1e293b;">${organisationName}</strong> a été créé avec succès sur Voxpopulous.fr, la plateforme de participation citoyenne pour les collectivités.
      </p>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; padding: 24px; margin: 24px 0; border-radius: 12px;">
        <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Vos identifiants de connexion</h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 14px;">Email</span><br/>
              <span style="color: #1e293b; font-weight: 500;">${email}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <span style="color: #64748b; font-size: 14px;">Mot de passe</span><br/>
              <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px; color: #1e293b; font-weight: 500;">${password}</code>
            </td>
          </tr>
        </table>
      </div>
      
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">Accéder à mon espace</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      
      <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px; text-align: center;">Découvrez vos outils</h3>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px; background: #eff6ff; border-radius: 8px; margin-bottom: 12px; vertical-align: top;" width="33%">
            <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 8px; margin-bottom: 12px; text-align: center; line-height: 40px; color: white; font-size: 18px; font-weight: bold;">i</div>
            <h4 style="color: #1e40af; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Boîte à idées</h4>
            <p style="color: #3b82f6; font-size: 12px; line-height: 1.5; margin: 0;">
              Recueillez les propositions de vos citoyens et permettez-leur de voter.
            </p>
          </td>
          <td width="4%"></td>
          <td style="padding: 16px; background: #fef3c7; border-radius: 8px; margin-bottom: 12px; vertical-align: top;" width="33%">
            <div style="width: 40px; height: 40px; background: #f59e0b; border-radius: 8px; margin-bottom: 12px; text-align: center; line-height: 40px; color: white; font-size: 18px; font-weight: bold;">!</div>
            <h4 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Signalements</h4>
            <p style="color: #b45309; font-size: 12px; line-height: 1.5; margin: 0;">
              Permettez aux habitants de signaler les problèmes locaux.
            </p>
          </td>
          <td width="4%"></td>
          <td style="padding: 16px; background: #dcfce7; border-radius: 8px; margin-bottom: 12px; vertical-align: top;" width="33%">
            <div style="width: 40px; height: 40px; background: #10b981; border-radius: 8px; margin-bottom: 12px; text-align: center; line-height: 40px; color: white; font-size: 18px; font-weight: bold;">R</div>
            <h4 style="color: #166534; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Réunions</h4>
            <p style="color: #15803d; font-size: 12px; line-height: 1.5; margin: 0;">
              Organisez des rencontres avec inscriptions en ligne.
            </p>
          </td>
        </tr>
      </table>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #1e293b; margin: 0 0 8px 0;">Besoin d'aide ?</h4>
        <p style="color: #475569; font-size: 14px; margin: 0;">
          Notre équipe est disponible pour vous accompagner. Contactez-nous à <a href="mailto:support@voxpopulous.fr" style="color: #3b82f6; text-decoration: none; font-weight: 500;">support@voxpopulous.fr</a>
        </p>
      </div>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Bienvenue sur Voxpopulous - Vos identifiants d'accès`,
      html: wrapEmailContent(content, { title: 'Bienvenue sur Voxpopulous' })
    });

    console.log(`Welcome email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
}


export async function sendQuoteEmail(
  recipientEmail: string,
  clientName: string,
  quoteNumber: string,
  total: number,
  validUntil: Date | null,
  pdfBuffer: Buffer,
  customMessage?: string,
  publicToken?: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    // Amounts are stored in euros, not cents - don't divide by 100
    const formattedTotal = total.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
    
    const validityDate = validUntil 
      ? new Date(validUntil).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Non spécifiée';

    console.log(`Resend: Sending quote email to ${recipientEmail} from ${fromEmail}`);
    
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; margin-bottom: 12px;">
          <span style="display: inline-block; line-height: 56px; color: white; font-size: 24px; font-weight: bold;">Q</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Votre devis ${quoteNumber}</h2>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Bonjour${clientName ? ` ${clientName}` : ''},
      </p>
      
      ${customMessage ? `<p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">${customMessage}</p>` : `
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Veuillez trouver ci-joint votre devis pour nos services de plateforme de participation citoyenne.
      </p>
      `}
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; padding: 24px; margin: 24px 0; border-radius: 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 14px;">Numéro de devis</span><br/>
              <span style="color: #1e293b; font-weight: 600; font-size: 16px;">${quoteNumber}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 14px;">Montant TTC</span><br/>
              <span style="color: #1e293b; font-weight: 700; font-size: 20px;">${formattedTotal}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: #64748b; font-size: 14px;">Validité</span><br/>
              <span style="color: #1e293b; font-weight: 500;">${validityDate}</span>
            </td>
          </tr>
        </table>
      </div>
      
      ${publicToken ? `
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${getBaseUrl()}/q/${publicToken}" 
           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">Consulter et valider le devis</a>
      </p>
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #166534; margin: 0 0 8px 0;">Pour accepter ce devis</h4>
        <p style="color: #166534; font-size: 14px; margin: 0;">
          Cliquez sur le bouton ci-dessus pour consulter le devis, choisir votre mode de paiement et le valider en ligne. Vous pouvez signer numériquement ou télécharger un document signé.
        </p>
      </div>
      ` : `
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #1e40af; margin: 0 0 8px 0;">Pour accepter ce devis</h4>
        <p style="color: #1e40af; font-size: 14px; margin: 0;">
          Vous pouvez nous retourner le devis signé par email ou nous contacter pour toute question à <a href="mailto:contact@voxpopulous.fr" style="color: #1e40af; font-weight: 500;">contact@voxpopulous.fr</a>
        </p>
      </div>
      `}
      
      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0 0; text-align: center;">
        Le devis est également disponible en pièce jointe au format PDF.
      </p>
    `;
    
    const result = await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Devis ${quoteNumber} - Voxpopulous`,
      html: wrapEmailContent(content, { title: 'Votre devis' }),
      attachments: [
        {
          filename: `Devis_${quoteNumber}.pdf`,
          content: pdfBuffer.toString('base64'),
        }
      ]
    });

    if (result.error) {
      console.error(`Failed to send quote email: ${result.error.message}`);
      return false;
    }
    
    console.log(`Quote email sent to ${recipientEmail} for quote ${quoteNumber}`, result.data);
    return true;
  } catch (error: any) {
    console.error('Failed to send quote email:', error?.message || error);
    console.error('Full error:', JSON.stringify(error, null, 2));
    return false;
  }
}

export async function sendInvoiceEmail(
  recipientEmail: string,
  clientName: string,
  invoiceNumber: string,
  totalEuros: number,
  dueDate: Date | null,
  pdfBuffer: Buffer,
  customMessage?: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const formattedTotal = totalEuros.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
    
    const formattedDueDate = dueDate 
      ? new Date(dueDate).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Non spécifiée';

    const content = `
      <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Votre facture ${invoiceNumber}</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Bonjour${clientName ? ` ${clientName}` : ''},
      </p>
      ${customMessage ? `<p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">${customMessage}</p>` : `
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Veuillez trouver ci-joint votre facture pour nos services de plateforme d'engagement citoyen.
      </p>
      `}
      <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px;">Recapitulatif</h3>
        <p style="color: #475569; margin: 0 0 8px 0;"><strong>Numero de facture :</strong> ${invoiceNumber}</p>
        <p style="color: #475569; margin: 0 0 8px 0;"><strong>Montant TTC :</strong> ${formattedTotal}</p>
        <p style="color: #475569; margin: 0;"><strong>Date d'echeance :</strong> ${formattedDueDate}</p>
      </div>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        La facture est disponible en piece jointe au format PDF.
      </p>
      <div style="background-color: #f8fafc; border-left: 4px solid #059669; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #047857; margin: 0 0 8px 0;">Modalites de paiement</h4>
        <p style="color: #047857; font-size: 14px; margin: 0;">
          Paiement par virement bancaire ou mandat administratif sous 30 jours.
        </p>
      </div>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Facture ${invoiceNumber} - Voxpopulous`,
      html: wrapEmailContent(content, { title: 'Votre facture' }),
      attachments: [
        {
          filename: `Facture_${invoiceNumber}.pdf`,
          content: pdfBuffer.toString('base64'),
        }
      ]
    });

    console.log(`Invoice email sent to ${recipientEmail} for invoice ${invoiceNumber}`);
    return true;
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    return false;
  }
}

export async function sendSignupConfirmationEmail(
  recipientEmail: string,
  recipientName: string,
  organisationName: string,
  registrationDate: Date,
  trialEndDate: Date,
  loginUrl: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const daysRemaining = Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    const content = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin-bottom: 16px;">
          <span style="display: inline-block; line-height: 72px; color: white; font-size: 32px; font-weight: bold;">OK</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 28px;">Bienvenue ${recipientName} !</h2>
        <p style="color: #64748b; margin: 0; font-size: 16px;">Votre inscription a bien été enregistrée</p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Votre espace <strong style="color: #1e293b;">${organisationName}</strong> a été créé avec succès sur Voxpopulous.fr.
      </p>
      
      <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; padding: 20px; margin: 24px 0; border-radius: 12px; text-align: center;">
        <p style="color: #166534; margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">Période d'essai gratuite</p>
        <p style="color: #166534; margin: 0; font-size: 32px; font-weight: 700;">${daysRemaining} jours</p>
        <p style="color: #15803d; margin: 8px 0 0 0; font-size: 14px;">Sans engagement, accès complet à toutes les fonctionnalités</p>
      </div>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; padding: 24px; margin: 24px 0; border-radius: 12px;">
        <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Récapitulatif de votre inscription</h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 14px;">Date d'inscription</span><br/>
              <span style="color: #1e293b; font-weight: 500;">${formatDate(registrationDate)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <span style="color: #64748b; font-size: 14px;">Fin de la période d'essai</span><br/>
              <span style="color: #1e293b; font-weight: 500;">${formatDate(trialEndDate)}</span>
            </td>
          </tr>
        </table>
      </div>
      
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">Accéder à mon espace d'administration</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      
      <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px; text-align: center;">Premiers pas sur Voxpopulous</h3>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px; background: #f8fafc; border-radius: 8px; vertical-align: top;" width="32%">
            <div style="text-align: center;">
              <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; margin: 0 auto 12px; text-align: center; line-height: 40px; color: white; font-weight: 700;">1</div>
              <h4 style="color: #1e293b; margin: 0 0 8px 0; font-size: 14px;">Personnalisez</h4>
              <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin: 0;">Ajoutez votre logo et personnalisez votre espace</p>
            </div>
          </td>
          <td width="2%"></td>
          <td style="padding: 16px; background: #f8fafc; border-radius: 8px; vertical-align: top;" width="32%">
            <div style="text-align: center;">
              <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; margin: 0 auto 12px; text-align: center; line-height: 40px; color: white; font-weight: 700;">2</div>
              <h4 style="color: #1e293b; margin: 0 0 8px 0; font-size: 14px;">Configurez</h4>
              <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin: 0;">Paramétrez les catégories et élus</p>
            </div>
          </td>
          <td width="2%"></td>
          <td style="padding: 16px; background: #f8fafc; border-radius: 8px; vertical-align: top;" width="32%">
            <div style="text-align: center;">
              <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; margin: 0 auto 12px; text-align: center; line-height: 40px; color: white; font-weight: 700;">3</div>
              <h4 style="color: #1e293b; margin: 0 0 8px 0; font-size: 14px;">Partagez</h4>
              <p style="color: #64748b; font-size: 12px; line-height: 1.4; margin: 0;">Communiquez le lien à vos citoyens</p>
            </div>
          </td>
        </tr>
      </table>
      
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #1e40af; margin: 0 0 8px 0;">Besoin d'aide ?</h4>
        <p style="color: #1e40af; font-size: 14px; margin: 0;">
          Notre équipe est disponible pour vous accompagner. Contactez-nous à <a href="mailto:support@voxpopulous.fr" style="color: #1e40af; font-weight: 500;">support@voxpopulous.fr</a>
        </p>
      </div>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Bienvenue sur Voxpopulous - Votre essai gratuit a commencé`,
      html: wrapEmailContent(content, { title: 'Bienvenue sur Voxpopulous' })
    });

    console.log(`Signup confirmation email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send signup confirmation email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  adminName: string,
  newPassword: string,
  tenantSlug: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const baseUrl = getBaseUrl();

    const content = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; margin-bottom: 16px;">
          <span style="display: inline-block; line-height: 64px; color: white; font-size: 24px; font-weight: bold;">Clé</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Réinitialisation de mot de passe</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">Un nouveau mot de passe vous a été attribué</p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${adminName},</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Votre mot de passe a été réinitialisé par l'administrateur de la plateforme Voxpopulous.
      </p>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; padding: 24px; margin: 24px 0; border-radius: 12px;">
        <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Vos nouveaux identifiants</h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-size: 14px;">Adresse email</span><br/>
              <span style="color: #1e293b; font-weight: 500;">${recipientEmail}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: #64748b; font-size: 14px;">Nouveau mot de passe</span><br/>
              <code style="display: inline-block; background: #e2e8f0; padding: 8px 16px; border-radius: 6px; color: #1e293b; font-weight: 600; font-size: 16px; letter-spacing: 1px; margin-top: 4px;">${newPassword}</code>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #92400e; font-size: 14px; margin: 0;">
          <strong>Recommandation de sécurité :</strong> Nous vous conseillons de changer ce mot de passe dès votre prochaine connexion pour garantir la sécurité de votre compte.
        </p>
      </div>
      
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${baseUrl}/structures/${tenantSlug}/admin/login" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">Se connecter maintenant</a>
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: "Réinitialisation de votre mot de passe - Voxpopulous",
      html: wrapEmailContent(content, { title: 'Réinitialisation de mot de passe' })
    });

    console.log(`Password reset email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

export async function sendTrialExpiryReminderEmail(
  recipientEmail: string,
  tenantName: string,
  expiryDate: string,
  daysRemaining: number
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const baseUrl = getBaseUrl();

    const urgencyLevel = daysRemaining <= 2 ? "urgent" : daysRemaining <= 7 ? "warning" : "info";
    const urgencyColors = {
      urgent: { bg: "#fef2f2", border: "#ef4444", icon: "#dc2626", iconBg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" },
      warning: { bg: "#fef3c7", border: "#f59e0b", icon: "#d97706", iconBg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" },
      info: { bg: "#eff6ff", border: "#3b82f6", icon: "#1d4ed8", iconBg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }
    };
    const colors = urgencyColors[urgencyLevel];

    const content = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 64px; height: 64px; background: ${colors.iconBg}; border-radius: 50%; margin-bottom: 16px;">
          <span style="display: inline-block; line-height: 64px; color: white; font-size: 20px; font-weight: bold;">FIN</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Votre période d'essai arrive à échéance</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">Organisation : ${tenantName}</p>
      </div>
      
      <div style="background: ${colors.bg}; border: 1px solid ${colors.border}; padding: 24px; margin: 24px 0; border-radius: 12px; text-align: center;">
        <p style="color: ${colors.icon}; margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">Temps restant</p>
        <p style="color: ${colors.icon}; margin: 0; font-size: 48px; font-weight: 700;">${daysRemaining}</p>
        <p style="color: ${colors.icon}; margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">jour${daysRemaining > 1 ? 's' : ''}</p>
        <p style="color: #64748b; margin: 16px 0 0 0; font-size: 13px;">Expiration le ${expiryDate}</p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour,</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        ${daysRemaining <= 2 ? 
          `<strong style="color: #dc2626;">Action urgente requise !</strong> Votre période d'essai gratuite pour <strong style="color: #1e293b;">${tenantName}</strong> expire très bientôt.` :
          `La période d'essai gratuite de <strong style="color: #1e293b;">${tenantName}</strong> arrive à échéance.`
        }
      </p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #1e293b; margin: 0 0 8px 0;">Ne perdez pas vos données</h4>
        <p style="color: #475569; font-size: 14px; margin: 0;">
          Souscrivez à un abonnement pour conserver l'ensemble de vos données et continuer à bénéficier de tous les services Voxpopulous.
        </p>
      </div>
      
      <h3 style="color: #1e293b; margin: 24px 0 16px 0; font-size: 18px; text-align: center;">Ce que vous conservez avec un abonnement</h3>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px; background: #f8fafc; border-radius: 8px; vertical-align: top;" width="48%">
            <span style="display: inline-block; width: 20px; height: 20px; background: #10b981; border-radius: 50%; text-align: center; line-height: 20px; color: white; font-size: 10px; font-weight: bold; margin-right: 8px; vertical-align: middle;">+</span>
            <span style="color: #1e293b; font-size: 14px;">Boîte à idées citoyennes</span>
          </td>
          <td width="4%"></td>
          <td style="padding: 12px; background: #f8fafc; border-radius: 8px; vertical-align: top;" width="48%">
            <span style="display: inline-block; width: 20px; height: 20px; background: #10b981; border-radius: 50%; text-align: center; line-height: 20px; color: white; font-size: 10px; font-weight: bold; margin-right: 8px; vertical-align: middle;">+</span>
            <span style="color: #1e293b; font-size: 14px;">Signalements d'incidents</span>
          </td>
        </tr>
        <tr><td colspan="3" height="8"></td></tr>
        <tr>
          <td style="padding: 12px; background: #f8fafc; border-radius: 8px; vertical-align: top;" width="48%">
            <span style="display: inline-block; width: 20px; height: 20px; background: #10b981; border-radius: 50%; text-align: center; line-height: 20px; color: white; font-size: 10px; font-weight: bold; margin-right: 8px; vertical-align: middle;">+</span>
            <span style="color: #1e293b; font-size: 14px;">Réunions publiques</span>
          </td>
          <td width="4%"></td>
          <td style="padding: 12px; background: #f8fafc; border-radius: 8px; vertical-align: top;" width="48%">
            <span style="display: inline-block; width: 20px; height: 20px; background: #10b981; border-radius: 50%; text-align: center; line-height: 20px; color: white; font-size: 10px; font-weight: bold; margin-right: 8px; vertical-align: middle;">+</span>
            <span style="color: #1e293b; font-size: 14px;">Espace associations</span>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0 0 32px 0; text-align: center;">
        <a href="${baseUrl}/contact" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">Souscrire à un abonnement</a>
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `${daysRemaining <= 2 ? '⚠️ ' : ''}Votre période d'essai expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} - Voxpopulous`,
      html: wrapEmailContent(content, { title: "Fin de période d'essai" })
    });

    console.log(`Trial expiry reminder email sent to ${recipientEmail} (${daysRemaining} days remaining)`);
    return true;
  } catch (error) {
    console.error('Failed to send trial expiry reminder email:', error);
    return false;
  }
}

export async function sendSubscriptionExpiryReminderEmail(
  recipientEmail: string,
  tenantName: string,
  expiryDate: string,
  daysRemaining: number,
  planName: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const baseUrl = getBaseUrl();

    const urgencyLevel = daysRemaining <= 2 ? "urgent" : daysRemaining <= 7 ? "warning" : "info";
    const urgencyColors = {
      urgent: { bg: "#fef2f2", border: "#ef4444" },
      warning: { bg: "#fef3c7", border: "#f59e0b" },
      info: { bg: "#f8fafc", border: "#3b82f6" }
    };
    const colors = urgencyColors[urgencyLevel];

    const content = `
      <h2 style="color: #1e293b; margin: 0 0 24px 0; font-size: 24px;">Votre abonnement arrive a echeance</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour,</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        L'abonnement <strong style="color: #1e293b;">${planName}</strong> de <strong style="color: #1e293b;">${tenantName}</strong> expire le <strong style="color: #1e293b;">${expiryDate}</strong>, soit dans <strong style="color: #1e293b;">${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}</strong>.
      </p>
      <div style="background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h4 style="color: #1e293b; margin: 0 0 8px 0;">${daysRemaining <= 2 ? 'Action urgente requise' : 'Pensez au renouvellement'}</h4>
        <p style="color: #475569; font-size: 14px; margin: 0;">
          Pour continuer a utiliser les services Voxpopulous sans interruption, veuillez proceder au renouvellement de votre abonnement avant la date d'echeance.
        </p>
      </div>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
        En cas de non-renouvellement, votre espace passera en mode lecture seule apres une periode de grace de 15 jours.
      </p>
      <p style="margin: 0 0 24px 0; text-align: center;">
        <a href="${baseUrl}/contact" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Nous contacter pour le renouvellement</a>
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Votre abonnement ${planName} expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} - Voxpopulous`,
      html: wrapEmailContent(content, { title: "Renouvellement d'abonnement" })
    });

    console.log(`Subscription expiry reminder email sent to ${recipientEmail} (${daysRemaining} days remaining)`);
    return true;
  } catch (error) {
    console.error('Failed to send subscription expiry reminder email:', error);
    return false;
  }
}

export async function sendRenewalReminderEmail(
  recipientEmail: string,
  tenantName: string,
  endDate: string,
  levelText: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Renouvellement de votre abonnement - ${levelText} - Voxpopulous`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e293b; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Voxpopulous</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0 0;">Relance de renouvellement</p>
          </div>
          
          <div style="padding: 30px; background: white;">
            <h2 style="color: #1e293b;">Votre abonnement arrive a echeance</h2>
            <p style="color: #475569; line-height: 1.6;">Bonjour,</p>
            <p style="color: #475569; line-height: 1.6;">
              L'abonnement de <strong>${tenantName}</strong> arrive a echeance le <strong>${endDate}</strong>.
            </p>
            
            <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h4 style="color: #92400e; margin-top: 0;">Action requise</h4>
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                Pour continuer a utiliser les services Voxpopulous sans interruption, veuillez proceder au renouvellement de votre abonnement avant la date d'echeance.
              </p>
            </div>
            
            <p style="color: #475569; line-height: 1.6;">
              En cas de non-renouvellement, votre espace passera en mode lecture seule apres une periode de grace de 15 jours.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://voxpopulous.fr/contact" 
                 style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Nous contacter pour le renouvellement
              </a>
            </div>
          </div>
          
          <div style="background: #1e293b; padding: 20px; text-align: center;">
            <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0;">
              Voxpopulous.fr - La voix de vos citoyens<br/>
              <a href="mailto:contact@voxpopulous.fr" style="color: rgba(255,255,255,0.9);">contact@voxpopulous.fr</a>
            </p>
          </div>
        </div>
      `
    });

    console.log(`Renewal reminder email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send renewal reminder email:', error);
    return false;
  }
}

export async function sendChatMessageToOfficialEmail(
  recipientEmail: string,
  officialName: string,
  senderName: string,
  senderEmail: string,
  subject: string,
  messageContent: string,
  organizationName: string,
  chatLink?: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();

    const chatButtonHtml = chatLink ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${chatLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Repondre dans le chat
        </a>
        <p style="color: #64748b; margin: 12px 0 0 0; font-size: 13px;">Cliquez pour acceder a la conversation et echanger en temps reel</p>
      </div>
    ` : '';

    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; margin-bottom: 12px;">
          <span style="display: inline-block; line-height: 56px; color: white; font-size: 24px;">@</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Nouveau message</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">De la part de <strong style="color: #1e293b;">${senderName}</strong></p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${officialName},</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Vous avez recu un nouveau message via votre page de profil sur ${organizationName}.
      </p>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0; border-radius: 0 12px 12px 0;">
        <p style="color: #64748b; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Sujet</p>
        <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px;">${subject}</h3>
        <p style="color: #64748b; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Message</p>
        <p style="color: #475569; margin: 0; line-height: 1.6; font-size: 14px; white-space: pre-wrap;">${messageContent}</p>
      </div>
      
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="color: #64748b; margin: 0; font-size: 13px;">
          <strong>Expediteur :</strong> ${senderName}<br/>
          <strong>Email :</strong> <a href="mailto:${senderEmail}" style="color: #3b82f6;">${senderEmail}</a>
        </p>
      </div>
      
      ${chatButtonHtml}
      
      <p style="color: #64748b; line-height: 1.6; margin: 0; font-size: 14px; text-align: center;">
        Cordialement,<br/>L'equipe Voxpopulous
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      replyTo: senderEmail,
      subject: `Nouveau message de ${senderName} - ${subject}`,
      html: wrapEmailContent(content, { title: 'Nouveau message', showHeroImage: false }),
    });

    console.log(`Chat message notification sent to official: ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send chat message to official:', error);
    return false;
  }
}

export async function sendChatReplyToRequesterEmail(
  recipientEmail: string,
  requesterName: string,
  officialName: string,
  subject: string,
  messageContent: string,
  organizationName: string,
  chatLink?: string
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();

    const chatButtonHtml = chatLink ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${chatLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Continuer la conversation
        </a>
        <p style="color: #64748b; margin: 12px 0 0 0; font-size: 13px;">Cliquez pour acceder a la conversation et echanger en temps reel</p>
      </div>
    ` : '';

    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; margin-bottom: 12px;">
          <span style="display: inline-block; line-height: 56px; color: white; font-size: 24px;">@</span>
        </div>
        <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 24px;">Reponse a votre message</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">De la part de <strong style="color: #1e293b;">${officialName}</strong></p>
      </div>
      
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Bonjour ${requesterName},</p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        ${officialName} de ${organizationName} a repondu a votre message.
      </p>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 0 12px 12px 0;">
        <p style="color: #64748b; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Concernant : ${subject}</p>
        <p style="color: #475569; margin: 0; line-height: 1.6; font-size: 14px; white-space: pre-wrap;">${messageContent}</p>
      </div>
      
      ${chatButtonHtml}
      
      <p style="color: #64748b; line-height: 1.6; margin: 0; font-size: 14px; text-align: center;">
        Cordialement,<br/>L'equipe ${organizationName}
      </p>
    `;

    await client.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `Reponse de ${officialName} - ${subject}`,
      html: wrapEmailContent(content, { title: 'Reponse a votre message', showHeroImage: false }),
    });

    console.log(`Chat reply notification sent to requester: ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send chat reply to requester:', error);
    return false;
  }
}
