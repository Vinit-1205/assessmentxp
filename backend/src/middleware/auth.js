const supabase = require('../db/postgresShim');

module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing or malformed token' });
    }

    const token = authHeader.split(' ')[1];
    
    // Validate token against Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token session' });
    }

    // Attach user information to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.app_metadata?.role || 'user',
      institution_id: user.app_metadata?.institution_id || null,
      active_role: user.app_metadata?.active_role || 'user',
    };

    next();
  } catch (error) {
    console.error('[auth middleware] Error:', error.message || error);
    const isProduction = process.env.NODE_ENV === 'production';
    return res.status(500).json({
      success: false,
      message: isProduction ? 'An unexpected error occurred.' : (error.message || 'Internal Server Error'),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
