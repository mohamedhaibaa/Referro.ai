export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Referro Waitlist <onboarding@resend.dev>',
        to: 'Referro.ai@gmail.com',
        subject: `New Waitlist Signup: ${cleanEmail}`,
        text: `New waitlist signup!\n\nEmail: ${cleanEmail}\nTime: ${new Date().toISOString()}\nSource: Landing page`,
      }),
    });

    if (!response.ok) {
      console.error('Resend error:', await response.text());
    }

    return res.status(200).json({ success: true, message: "You're on the list! We'll be in touch soon." });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(200).json({ success: true, message: "You're on the list! We'll be in touch soon." });
  }
}
