const Footer = require('../models/footer');
const crypto = require('crypto');
const fs = require('fs').promises;


exports.getFooter = async (req, res) => {
  try {
    // Fetch the footer record
    const footer = await Footer.findOne({ where: { id: 1 } });

    if (!footer) {
      return res.status(404).json({ message: 'Footer not found' });
    }

    // Load public key with absolute path
    let publicKey;
    try {
      publicKey = await fs.readFile('/opt/View/FlameHealth-Suite/keys/public.pem', 'utf8');
    } catch (fileError) {
      console.error('Error reading public.pem:', fileError);
      return res.status(500).json({ message: 'Failed to load public key' });
    }

    // Clean signature
    let cleanedSignature = footer.signature.trim();

    // Verify signature
  let isVerified;
  try {
    const signatureBuffer = Buffer.from(cleanedSignature, 'base64');
    isVerified = crypto.verify(
      'sha256',
      Buffer.from(footer.content, 'utf8'), // Ensure content is treated as UTF-8
      {
        key: publicKey,
        // CHANGE THIS LINE:
        padding: crypto.constants.RSA_PKCS1_PADDING, // <--- Use PKCS1_PADDING
      },
      signatureBuffer
    );
  } catch (verifyError) {
    console.error('Signature verification error:', verifyError);
    return res.status(403).json({ message: 'Signature verification failed' });
  }

    if (!isVerified) {
      console.error('Invalid signature for footer content:', footer.content);
      return res.status(403).json({ message: 'Invalid footer signature' });
    }

    // Return verified content
    res.status(200).json({ content: footer.content });
  } catch (error) {
    console.error('Error fetching footer:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
