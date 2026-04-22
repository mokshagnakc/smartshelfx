import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

function passwordStrengthValidator(c: AbstractControl): ValidationErrors | null {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@#_]).{8,}$/.test(c.value || '')
        ? null : { passwordStrength: true };
}

function confirmPasswordValidator(g: AbstractControl): ValidationErrors | null {
    const pw = g.get('newPassword')?.value;
    const cp = g.get('confirmPassword')?.value;
    return pw && cp && pw !== cp ? { passwordMismatch: true } : null;
}

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
    form: FormGroup;
    loading = false;
    success = false;
    errorMsg = '';
    showNew = false;
    showConfirm = false;

    pwRules = [
        { label: 'Minimum 8 characters', regex: /.{8,}/ },
        { label: 'At least one uppercase (A-Z)', regex: /[A-Z]/ },
        { label: 'At least one lowercase (a-z)', regex: /[a-z]/ },
        { label: 'At least one number (0-9)', regex: /[0-9]/ },
        { label: 'At least one special (@, #, _)', regex: /[@#_]/ }
    ];

    constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
        this.form = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            newPassword: ['', [Validators.required, passwordStrengthValidator]],
            confirmPassword: ['', Validators.required]
        }, { validators: confirmPasswordValidator });
    }

    get f() { return this.form.controls; }
    get pwVal() { return this.f['newPassword'].value || ''; }
    rulePass(r: RegExp) { return r.test(this.pwVal); }

    submit() {
        this.errorMsg = '';
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        this.loading = true;
        this.http.post(environment.apiUrl + '/auth/reset-direct', {
            email: this.form.value.email.trim().toLowerCase(),
            newPassword: this.form.value.newPassword
        }).subscribe({
            next: () => { this.loading = false; this.success = true; },
            error: (err) => {
                this.loading = false;
                this.errorMsg = err?.error?.error || 'Reset failed. Check your email and try again.';
            }
        });
    }

    goLogin() { this.router.navigate(['/auth/login']); }
}