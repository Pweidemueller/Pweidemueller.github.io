document.addEventListener('DOMContentLoaded', () => {
    console.log('Site loaded successfully!');

    // Email Obfuscation
    const emailLink = document.getElementById('contact-email');
    if (emailLink) {
        const user = emailLink.getAttribute('data-user');
        const domain = emailLink.getAttribute('data-domain');
        const email = `${user}@${domain}`;

        emailLink.href = `mailto:${email}`;
        emailLink.innerText = email;
    }
});
