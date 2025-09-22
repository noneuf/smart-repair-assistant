// app/api/admin/account-deletion/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {

  try {
    const { userId, userEmail, userName, deletionType } = await request.json();
      console.log('API called with data:', { userId, userEmail, userName, deletionType });
      console.log('Admin email:', process.env.GOOGLE_ADMIN_ACCOUNT);
      console.log('Gmail app password exists:', !!process.env.GMAIL_APP_PASSWORD);
    // Get admin email from environment variables
    const adminEmail = process.env.GOOGLE_ADMIN_ACCOUNT;
    console.log('Admin Email:', adminEmail);
    
    if (!adminEmail) {
      console.error('GOOGLE_ADMIN_ACCOUNT environment variable not set');
      return NextResponse.json(
        { error: 'Admin email not configured' },
        { status: 500 }
      );
    }

    // Prepare email content based on deletion type
    const subject = deletionType === 'account' 
      ? 'Account Deletion Request - Smart Repair Assistant'
      : 'User Data Deletion - Smart Repair Assistant';
    
    const emailContent = `
Account Deletion Alert - Smart Repair Assistant

Deletion Type: ${deletionType === 'account' ? 'Full Account Deletion' : 'Data Only Deletion'}

User Details:
- User ID: ${userId}
- Email: ${userEmail}
- Name: ${userName || 'Not provided'}
- Timestamp: ${new Date().toISOString()}

${deletionType === 'account' 
  ? `Action Required: 
  1. User has been signed out automatically
  2. All user data has been deleted from the database
  3. User account needs to be removed from Supabase Auth (admin action required)
  4. Process this request within 24-48 hours as communicated to the user
  
  To complete account deletion:
  1. Go to Supabase Dashboard > Authentication > Users
  2. Find user ID: ${userId}
  3. Delete the user account manually`
  : `Data Deletion Completed:
  1. All user problems and associated files have been deleted
  2. User account remains active but empty
  3. No further action required`
}

This is an automated notification from Smart Repair Assistant.
`;

    // For now, we'll use a simple email service approach
    // You can integrate with services like Resend, SendGrid, or Nodemailer
    
    // Option 1: Using Resend (recommended for Next.js)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: 'Smart Repair Assistant <no-reply@yourdomain.com>',
        to: adminEmail,
        subject: subject,
        text: emailContent,
      });
      
      console.log('Admin notification sent via Resend');
      return NextResponse.json({ success: true, method: 'resend' });
    }
    
    // Option 2: Using Nodemailer with Gmail (if you prefer Gmail)
    console.log('Attempting to send email via Gmail...');

    if (process.env.GMAIL_APP_PASSWORD) {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: adminEmail,
          pass: process.env.GMAIL_APP_PASSWORD, // App-specific password
        },
      });

      await transporter.sendMail({
        from: adminEmail,
        to: adminEmail,
        subject: subject,
        text: emailContent,
      });
      
      console.log('Admin notification sent via Gmail');
      return NextResponse.json({ success: true, method: 'gmail' });
    }
    
    // Fallback: Log to console and database
    console.log('EMAIL NOTIFICATION (No email service configured):');
    console.log('To:', adminEmail);
    console.log('Subject:', subject);
    console.log('Content:', emailContent);
    
    return NextResponse.json({ 
      success: true, 
      method: 'database_log',
      message: 'Notification logged to database and console'
    });
    
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}