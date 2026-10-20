// Legal documents shown at /terms, /privacy and /refund-policy.
// Business details live in LEGAL so they can be updated in one place.

export const LEGAL = {
  company: 'twinsCloud',
  product: 'Smart Hospital Management Software',
  email: 'support@twinscloud.com',
  grievanceEmail: 'support@twinscloud.com',
  // Shown only when filled in
  address: '',
  jurisdiction: 'the competent courts of Uttar Pradesh, India',
  effectiveDate: '20 October 2026',
  version: '1.0'
};

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: 'terms' | 'privacy' | 'refund-policy';
  title: string;
  summary: string;
  highlights: string[];
  sections: LegalSection[];
}

const p = (text: string): LegalBlock => ({ type: 'p', text });
const ul = (...items: string[]): LegalBlock => ({ type: 'ul', items });

const { company, product, email, grievanceEmail, jurisdiction } = LEGAL;

export const TERMS: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  summary: `These terms govern your hospital's use of ${product}. By registering a hospital or using the software you agree to them on behalf of your organisation.`,
  highlights: [
    'You own all hospital and patient data you enter',
    'Plans are prepaid for a fixed term — no automatic renewal or hidden charges',
    'Doctors stay fully responsible for every clinical decision',
    'Either side can end the agreement; your data can be exported'
  ],
  sections: [
    {
      id: 'about', title: '1. About these terms',
      blocks: [
        p(`${product} (the "Service") is a cloud software platform operated by ${company} ("we", "us"). It provides OPD registration, doctor queues, e-prescriptions, pharmacy and inventory, billing, accounts and related tools for hospitals and clinics.`),
        p('"Customer" or "you" means the hospital, clinic or organisation that registers an account. "Authorised Users" are the administrators, doctors, receptionists, pharmacists and other staff the Customer gives access to. "Customer Data" is all information entered into the Service by or for the Customer, including patient records.'),
        p('The person who registers confirms they are at least 18 years old and authorised to accept these terms for the Customer.')
      ]
    },
    {
      id: 'accounts', title: '2. Accounts and access',
      blocks: [
        ul(
          'The hospital administrator controls who gets access and which role they have. You are responsible for everything done through your accounts.',
          'Keep passwords and the hospital access code confidential. Each staff member must use their own login — shared logins are not allowed.',
          'Remove or deactivate a staff login as soon as that person leaves your organisation.',
          'Tell us immediately at ' + email + ' if you suspect unauthorised access.'
        )
      ]
    },
    {
      id: 'trial-plans', title: '3. Free trial, plans and payment',
      blocks: [
        p('New hospitals may start a free trial for the period shown at sign-up (currently 14 days). The trial includes the features of the chosen plan and no payment details are needed. When the trial ends, staff logins pause until a paid plan is activated.'),
        ul(
          'Paid plans are bought for a fixed term (for example 12 months) and are activated with a license key issued by us after payment.',
          'Fees are payable in advance, in Indian Rupees, and are exclusive of GST and other applicable taxes, which are added to the invoice.',
          'Plans do not renew automatically. Before expiry we remind the administrator; renewing with a new license key extends the current expiry date.',
          'Each plan limits the number of doctor, receptionist and pharmacist logins and the storage available. Upgrading takes effect as soon as the new license key is applied.',
          'We may change plan prices for future terms with at least 30 days\' notice. Prices for a term you have already paid for will not change.'
        ),
        p('Refunds and cancellations are covered by our Refund & Cancellation Policy, which forms part of these terms.')
      ]
    },
    {
      id: 'expiry', title: '4. Expiry, suspension and termination',
      blocks: [
        ul(
          'When a subscription expires, staff logins are paused. The hospital administrator can still sign in to view records, export data and renew.',
          'We may suspend access, after notice where reasonably possible, for non-payment, a serious breach of these terms, a security threat, or when required by law. We restore access promptly once the issue is resolved.',
          'You may stop using the Service at any time. We may end the agreement with 30 days\' written notice, or immediately for a material breach that is not fixed within 15 days of notice.',
          'Customer Data is kept for at least 90 days after expiry or termination so you can renew or request an export. After that we may permanently delete it, after giving the administrator at least 15 days\' e-mail notice.'
        )
      ]
    },
    {
      id: 'customer-data', title: '5. Your data',
      blocks: [
        p('You own all Customer Data. We use it only to provide, secure, support and improve the Service for you, as described in our Privacy Policy. We do not sell Customer Data or use patient data for advertising.'),
        p('For patient personal data you are the Data Fiduciary under the Digital Personal Data Protection Act, 2023, and we act as your Data Processor. This means:'),
        ul(
          'You decide what patient data is collected and why, give patients any required notice, and obtain any required consent — including consent of a parent or guardian for children.',
          'We process patient data only on your instructions, through the Service, and keep it confidential.',
          'We protect it with reasonable security safeguards and restrict access to personnel who need it to run or support the Service.',
          'We notify you without undue delay of any personal data breach affecting your data and help you meet your reporting duties.',
          'We help you respond to patient requests for access, correction or erasure where you cannot do so yourself in the software.',
          'On request, and at the end of the agreement, we provide an export of your data and then delete it as described in section 4.'
        ),
        p('You are responsible for the accuracy of the data you enter and for keeping medical records for as long as the law requires.')
      ]
    },
    {
      id: 'acceptable-use', title: '6. Acceptable use',
      blocks: [
        p('You and your Authorised Users must not:'),
        ul(
          'enter data about people without a lawful basis, or use the Service for anything illegal or fraudulent;',
          'try to access another hospital\'s data, probe or bypass security, or overload the Service with automated requests;',
          'copy, resell, sub-license or reverse-engineer the software, or build a competing product from it;',
          'upload malware or content that infringes someone else\'s rights;',
          'share logins or license keys with anyone outside your organisation.'
        )
      ]
    },
    {
      id: 'medical', title: '7. Medical disclaimer',
      blocks: [
        p('The Service is an administrative and record-keeping tool. It does not give medical advice, diagnose or treat, and it is not a certified medical device.'),
        p('Features such as voice-to-text prescriptions, medicine suggestions and stock alerts are aids only. The treating doctor must check every prescription and clinical entry before it is saved, printed or dispensed, and remains fully responsible for clinical decisions. Pharmacists remain responsible for verifying every prescription before dispensing.')
      ]
    },
    {
      id: 'availability', title: '8. Availability and support',
      blocks: [
        ul(
          'We aim to keep the Service available 24×7 and take regular backups, but we do not guarantee uninterrupted or error-free operation.',
          'Planned maintenance is announced in advance where possible and scheduled outside busy OPD hours when we can.',
          `Support is provided by e-mail at ${email}. We aim to respond within one business day.`,
          'You need a working internet connection and a modern browser. Keep printed or offline fallbacks for emergencies.'
        )
      ]
    },
    {
      id: 'ip', title: '9. Intellectual property',
      blocks: [
        p(`The software, design, logos and documentation belong to ${company}. We grant you a non-exclusive, non-transferable right to use the Service for your internal hospital operations during your subscription. Suggestions you send us may be used to improve the Service without obligation.`)
      ]
    },
    {
      id: 'liability', title: '10. Warranties and liability',
      blocks: [
        p('Except as stated in these terms, the Service is provided "as is", and we disclaim implied warranties to the extent the law allows.'),
        p('Neither party is liable for indirect or consequential losses, such as loss of profit, revenue or goodwill. Our total liability arising from the Service in any 12-month period is limited to the fees you paid us in that period.'),
        p('These limits do not apply to liability that cannot be limited by law, or to a party\'s breach of confidentiality or wilful misconduct. You will compensate us for claims arising from data you entered without a lawful basis or from your breach of the acceptable-use rules.')
      ]
    },
    {
      id: 'general', title: '11. General',
      blocks: [
        ul(
          'Neither party is responsible for delays caused by events beyond reasonable control, such as power or internet outages, natural disasters or government action.',
          'We may update these terms. Material changes are notified to administrators by e-mail or in the app at least 15 days before they take effect. If you keep using the Service after that, the updated terms apply.',
          `These terms are governed by the laws of India. Disputes will first be discussed in good faith; if they are not resolved within 30 days, ${jurisdiction} have exclusive jurisdiction.`,
          'If any part of these terms is found unenforceable, the rest remains in effect.'
        ),
        p(`Questions about these terms: ${email}.`)
      ]
    }
  ]
};

export const PRIVACY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary: `How ${company} collects, uses and protects personal data in ${product}, and the choices you have.`,
  highlights: [
    'Patient data belongs to the hospital — we only process it for them',
    'No selling of data and no advertising trackers',
    'Each hospital\'s data is isolated on the server',
    `Grievances answered at ${grievanceEmail}`
  ],
  sections: [
    {
      id: 'scope', title: '1. Who this policy covers',
      blocks: [
        p('This policy explains how we handle personal data of three groups: people who visit our website or register a hospital; hospital staff who use the software; and patients whose records hospitals store in the software.'),
        p('For patient records, the hospital is the Data Fiduciary and decides why and how the data is used; we process it on the hospital\'s behalf. Patients should contact their hospital first to access, correct or erase their records. We will help the hospital respond.')
      ]
    },
    {
      id: 'collect', title: '2. Data we collect',
      blocks: [
        ul(
          'Account details: hospital name, address, phone, administrator name and e-mail, and the name, role, contact number, e-mail and (optionally) registration number and signature of staff members.',
          'Patient records entered by the hospital: name, phone, age, gender, patient number, vitals, past diagnoses, appointments, consultation status, prescriptions, invoices and pharmacy bills.',
          'Billing data: plan, license keys, subscription invoices and payment status. We do not store card or bank details in the software.',
          'Technical data: IP address, browser type, login times and security events such as failed sign-ins, used to keep the Service secure.',
          'Messages you send us, for example support e-mails.'
        )
      ]
    },
    {
      id: 'use', title: '3. How we use data',
      blocks: [
        ul(
          'To run the Service: sign-in, OPD queues, prescriptions, billing, printing and reports for the hospital.',
          'To send service e-mails: login credentials, password-reset alerts, security alerts and subscription reminders.',
          'To secure the Service: detecting misuse, rate-limiting and locking accounts after repeated failed logins.',
          'To provide support, fix problems and improve features, using aggregated or de-identified information wherever possible.',
          'To meet legal obligations, such as tax records and responding to lawful requests from authorities.'
        ),
        p('We do not sell personal data, use patient data for advertising, or use it to train any third-party AI model.')
      ]
    },
    {
      id: 'sharing', title: '4. Service providers we use',
      blocks: [
        p('We share data only with providers that help us run the Service, under confidentiality obligations, and only as much as each needs:'),
        ul(
          'Cloud hosting and database providers that store and serve the application and its data.',
          'An e-mail (SMTP) provider that delivers service e-mails.',
          'Google Fonts, which serves the typeface used on our pages and receives your IP address when fonts load.',
          'Voice prescription: the voice-to-text feature uses your browser\'s built-in speech recognition. In Google Chrome and Microsoft Edge, the audio is sent to the browser maker\'s speech service to be converted to text. Doctors who prefer not to use it can type prescriptions instead.'
        ),
        p('We may disclose data if required by law, court order or a lawful request of a government authority, and will tell the affected hospital unless the law forbids it.')
      ]
    },
    {
      id: 'security', title: '5. How we protect data',
      blocks: [
        ul(
          'Every request is checked on the server and limited to the signed-in user\'s own hospital, so one hospital cannot see another hospital\'s data.',
          'Role-based access: staff only see the tools their role needs.',
          'Passwords are stored as bcrypt hashes; sessions use signed, expiring tokens; repeated failed logins trigger a temporary lockout.',
          'Data is sent over encrypted HTTPS connections, and access to production systems is limited to authorised personnel.',
          'Database backups, and audit logs of important actions such as role changes and password resets.'
        ),
        p('No system is completely secure. If a personal data breach affects your data, we will inform the affected hospitals without undue delay, help them notify patients and the Data Protection Board of India where required, and report to CERT-In as required by law.')
      ]
    },
    {
      id: 'retention', title: '6. How long we keep data',
      blocks: [
        ul(
          'Customer Data is kept while the hospital\'s account is active.',
          'After a subscription expires or the account is closed, data is kept for at least 90 days so the hospital can renew or request an export. After that it may be permanently deleted, after at least 15 days\' e-mail notice to the administrator.',
          'Hospitals are responsible for keeping medical records for the period required by law; please export your records before deletion if you need them.',
          'Billing and tax records are kept for as long as tax law requires. Security and audit logs are kept while the account is active and deleted with it.'
        )
      ]
    },
    {
      id: 'rights', title: '7. Your rights and choices',
      blocks: [
        p('Under the Digital Personal Data Protection Act, 2023 you may ask to access a summary of your personal data, correct or update it, erase it where it is no longer needed, nominate someone to exercise your rights, and raise a grievance.'),
        ul(
          'Hospital staff can update most of their own profile in the app, or ask their hospital administrator.',
          'Patients should contact the hospital that holds their records.',
          `Anyone can write to us at ${grievanceEmail}. We may need to verify your identity before acting on a request.`
        )
      ]
    },
    {
      id: 'storage', title: '8. Browser storage and cookies',
      blocks: [
        p('We do not use advertising or tracking cookies. The software stores your session token, profile and display preferences (such as print settings) in your browser\'s local storage so you stay signed in. Signing out clears your session; you can also clear it from your browser settings.')
      ]
    },
    {
      id: 'children', title: '9. Children',
      blocks: [
        p('Our website and staff accounts are not meant for anyone under 18. Hospitals may store records of child patients; the hospital is responsible for obtaining verifiable consent from a parent or guardian where the law requires it.')
      ]
    },
    {
      id: 'grievance', title: '10. Grievance Officer and contact',
      blocks: [
        p(`If you have a question or complaint about how personal data is handled, contact our Grievance Officer at ${grievanceEmail}. We acknowledge complaints within 48 hours and aim to resolve them within 15 days. If you are not satisfied with our response, you may approach the Data Protection Board of India.`)
      ]
    },
    {
      id: 'changes', title: '11. Changes to this policy',
      blocks: [
        p('We will post any changes on this page with a new effective date. Material changes are notified to hospital administrators by e-mail or in the app before they take effect.')
      ]
    }
  ]
};

export const REFUND: LegalDocument = {
  slug: 'refund-policy',
  title: 'Refund & Cancellation Policy',
  summary: 'Clear rules for trials, cancellations, refunds and plan changes.',
  highlights: [
    'Free trial — nothing to cancel, nothing charged',
    'Full refund within 7 days if the license key is not activated',
    'No automatic renewals',
    'Refunds paid within 7–10 business days'
  ],
  sections: [
    {
      id: 'trial', title: '1. Free trial',
      blocks: [
        p('The free trial costs nothing and needs no payment details. If you do not activate a paid plan, staff access simply pauses when the trial ends. There is nothing to cancel.')
      ]
    },
    {
      id: 'cancellation', title: '2. Cancelling a paid plan',
      blocks: [
        ul(
          'Plans are prepaid for a fixed term and never renew automatically, so no future charge happens unless you buy a new license key.',
          'You can stop using the Service at any time. Your access continues until the end of the term you paid for.',
          `To close your account and have your data exported or deleted, the hospital administrator can e-mail ${email}.`
        )
      ]
    },
    {
      id: 'eligible', title: '3. When you get a refund',
      blocks: [
        ul(
          'Full refund if you ask within 7 days of payment and the license key has not yet been activated.',
          'Full refund of any duplicate or excess payment.',
          'A pro-rata refund for unused full months if we end the agreement without cause, or if the Service is unavailable for a long period because of a fault on our side that we cannot fix within a reasonable time.'
        )
      ]
    },
    {
      id: 'not-eligible', title: '4. When refunds are not given',
      blocks: [
        ul(
          'Once a license key has been activated, the fee for that term is non-refundable, except in the cases listed above.',
          'Partly used terms, or periods when you chose not to use the Service.',
          'Suspension or termination because of a breach of the Terms of Service, such as misuse or sharing of logins.',
          'Taxes already paid to the government on an invoice are refunded only if they can be recovered.'
        )
      ]
    },
    {
      id: 'changes', title: '5. Upgrades and downgrades',
      blocks: [
        ul(
          'Upgrade any time by applying a license key for the higher plan. The new plan applies immediately and the new term is added to your current expiry date, so no paid days are lost.',
          'Downgrades take effect at your next renewal. If you have more staff logins than the smaller plan allows, existing logins keep working but new ones cannot be added until you are within the limit.'
        )
      ]
    },
    {
      id: 'process', title: '6. How to request a refund',
      blocks: [
        p(`E-mail ${email} from the hospital administrator's registered address with the hospital name, invoice or payment reference, license key and the reason. We confirm eligibility within 3 business days. Approved refunds are paid to the original payment method within 7–10 business days.`)
      ]
    }
  ]
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [TERMS, PRIVACY, REFUND];
