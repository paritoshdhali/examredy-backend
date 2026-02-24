const subscriptionCheck = (req, res, next) => {
    const isPremium = req.user && (
        req.user.role === 'admin' ||
        (req.user.is_premium && (req.user.sessions_left > 0 || (req.user.premium_expiry && new Date(req.user.premium_expiry) > new Date())))
    );

    if (isPremium) {
        req.isPremium = true;
        next();
    } else {
        req.isPremium = false;
        next();
    }
};

module.exports = { subscriptionCheck };
