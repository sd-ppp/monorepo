export function validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
}

export function formatPhoneNumber(phone: string): string {
    return phone.replace(/\s+/g, '').replace(/[^\d]/g, '');
}

export class PhoneValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PhoneValidationError';
    }
}