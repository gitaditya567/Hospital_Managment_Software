import { ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password?: string;
  onPasswordChange?: (password: string) => void;
}

export function PasswordStrengthMeter({ password = '' }: PasswordStrengthMeterProps) {
  const getStrength = (pass: string) => {
    let score = 0;
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200', text: 'text-slate-400' };

    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
      case 2:
        return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-600' };
      case 3:
      case 4:
        return { score: 2, label: 'Medium', color: 'bg-amber-500', text: 'text-amber-600' };
      case 5:
        return { score: 3, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' };
      default:
        return { score: 0, label: '', color: 'bg-slate-200', text: 'text-slate-400' };
    }
  };

  const strength = getStrength(password);

  const requirements = [
    { label: 'At least 6 characters', met: password.length >= 6 },
    { label: 'Contains a number', met: /[0-9]/.test(password) },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          {strength.score === 3 ? (
            <ShieldCheck size={14} className="text-emerald-500" />
          ) : (
            <ShieldAlert size={14} className={strength.text} />
          )}
          <span>Password strength:</span>
        </div>
        <span className={`font-bold ${strength.text}`}>{strength.label}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-300 ${strength.score >= 1 ? strength.color : 'bg-slate-200'}`} />
        <div className={`h-full transition-all duration-300 ${strength.score >= 2 ? strength.color : 'bg-slate-200'}`} />
        <div className={`h-full transition-all duration-300 ${strength.score >= 3 ? strength.color : 'bg-slate-200'}`} />
      </div>

      <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] text-slate-500">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-1">
            {req.met ? (
              <Check size={12} className="text-emerald-500 shrink-0" />
            ) : (
              <X size={12} className="text-slate-300 shrink-0" />
            )}
            <span className={req.met ? 'text-slate-700 font-medium' : 'text-slate-400'}>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
