const defaultSubject = (type) => {
  const parts = type.split('.');
  const label = parts[parts.length - 1] || 'update';
  return `Notification: ${label.replace(/_/g, ' ')}`;
};

const linkify = (url) => {
  if (!url) return '';
  return `<p><a href="${url}">View details</a></p>`;
};

export const buildEmailContent = ({ type, payload = {}, unsubscribeUrl }) => {
  const subject = payload.subject || payload.title || defaultSubject(type);
  const body = payload.body || payload.message || 'You have a new notification.';
  const deepLink = payload.deepLink || payload.url;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px 0; color: #0f172a;">${subject}</h2>
      <p style="margin: 0 0 12px 0;">${body}</p>
      ${linkify(deepLink)}
      <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #475569;">
        You are receiving this email because you opted in to ${type}.
        <br/>
        <a href="${unsubscribeUrl}">Unsubscribe</a>
      </p>
    </div>
  `;

  const textLines = [subject, '', body];
  if (deepLink) {
    textLines.push(`View details: ${deepLink}`);
  }
  if (unsubscribeUrl) {
    textLines.push('', `Unsubscribe: ${unsubscribeUrl}`);
  }

  return {
    subject,
    html,
    text: textLines.join('\n')
  };
};




