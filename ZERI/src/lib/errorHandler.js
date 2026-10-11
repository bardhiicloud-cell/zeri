export const ErrorCodes = {
    UNAUTHORIZED: 'auth/unauthorized',
    NOT_FOUND: 'db/not_found',
    VALIDATION_ERROR: 'val/invalid_input',
    NETWORK_ERROR: 'net/timeout',
    UPLOAD_FAILED: 'fs/upload_failed'
};
export const handleFirebaseError = (error) => {
    const errCode = error?.code || 'unknown';
    const technicalMessage = error?.message || 'Ndodhi një gabim i panjohur. Ju lutem provoni përsëri.';
    let friendlyMessage = technicalMessage;
    switch (errCode) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            friendlyMessage = 'Email ose fjalëkalimi është i pasaktë.';
            break;
        case 'auth/email-already-in-use':
            friendlyMessage = 'Ekziston tashmë një llogari me këtë email.';
            break;
        case 'permission-denied':
            friendlyMessage = 'Nuk keni privilegje për të kryer këtë veprim (Aksesi i refuzuar).';
            break;
    }
    return {
        code: errCode,
        message: friendlyMessage,
        technicalMessage
    };
};
export const showGenericError = (message) => {
    return {
        code: 'APP_ERR',
        message
    };
};
