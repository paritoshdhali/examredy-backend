const subscriptionCheck = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || (req.user.is_premium && new Date(req.user.premium_expiry) > new Date()))) {
        next();
    } else {
        // Here we could handle free limit logic or return specific code
        // For now, let's attach a flag so controllers can decide
        req.isPremium = false;
        next(); // Allow through, but controller checks limits
    }
};

module.exports = { subscriptionCheck };
