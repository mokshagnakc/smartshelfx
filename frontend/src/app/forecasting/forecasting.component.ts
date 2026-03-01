import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { NotificationService } from '../shared/services/notification.service';
import { ForecastResult } from '../shared/models/interfaces';

@Component({
    selector: 'app-forecasting',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective],
    templateUrl: './forecasting.component.html',
    styleUrls: ['./forecasting.component.scss']
})
export class ForecastingComponent implements OnInit {

    forecasts: ForecastResult[] = [];
    loading = false;
    running = false;

    selectedHorizon = '7';
    lastRunTime = '';


    fcData: ChartConfiguration<'line'>['data'] = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon+1', 'Tue+1'],
        datasets: [
            { label: 'Historical Demand', data: [8, 6, 7, 5, 6, 4, 5, null!, null!], borderColor: '#00b4ff', borderWidth: 2, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#00b4ff' },
            { label: 'AI Forecast', data: [null!, null!, null!, null!, null!, null!, 5, 7, 9], borderColor: '#00ffcc', borderDash: [5, 5], borderWidth: 2, tension: 0.4, pointRadius: 4, pointStyle: 'triangle', pointBackgroundColor: '#00ffcc' },
            { label: 'Current Stock', data: [5, 5, 5, 5, 5, 5, 5, 5, 5], borderColor: 'rgba(255,170,0,0.55)', borderDash: [3, 3], borderWidth: 1.5, pointRadius: 0 }
        ]
    };

    fcOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        plugins: { legend: { labels: { color: 'rgba(255,255,255,0.5)', font: { family: 'Rajdhani', size: 12 } } } },
        scales: {
            x: { ticks: { color: 'rgba(255,255,255,0.4)' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: 'rgba(255,255,255,0.4)' }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
    };


    riskData: ChartConfiguration<'doughnut'>['data'] = {
        labels: ['Critical', 'High Risk', 'Medium Risk', 'Low Risk'],
        datasets: [{ data: [4, 20, 45, 179], backgroundColor: ['#ff4d6d', '#ff8c00', '#ffaa00', '#00ffcc'], borderWidth: 0, hoverOffset: 8 }]
    };
    riskOptions: ChartConfiguration<'doughnut'>['options'] = {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.5)', font: { family: 'Rajdhani', size: 12 }, padding: 12, boxWidth: 12 } } }
    };

    constructor(private api: ApiService, private notify: NotificationService) { }

    ngOnInit() { this.loadForecasts(); }

    loadForecasts() {
        this.loading = true;
        this.api.getForecasts().subscribe({
            next: res => { this.forecasts = res; this.loading = false; },
            error: () => { this.loading = false; this.forecasts = this.demoForecasts(); }
        });
    }

    runForecast() {
        this.running = true;
        this.api.runForecast().subscribe({
            next: res => {
                this.notify.success(res.message || 'Forecast complete!');
                this.lastRunTime = new Date().toLocaleTimeString();
                this.running = false;
                this.loadForecasts();
            },
            error: err => {
                this.notify.error('Forecast service unavailable — start ml-service/main.py');
                this.running = false;
            }
        });
    }

    getRiskClass(level: string): string {
        const map: Record<string, string> = { CRITICAL: 'crit', HIGH: 'risk-high', MEDIUM: 'risk-med', LOW: 'risk-low' };
        return map[level] || 'risk-low';
    }

    getConfidencePct(conf: number): string { return `${Math.round(conf * 100)}%`; }

    private demoForecasts(): ForecastResult[] {
        return [
            { id: 1, product_id: 1, Product: { id: 1, name: 'Laptop Stand Pro', sku: 'SKU-001', category: 'Electronics', vendor_id: 3, reorder_level: 15, current_stock: 5, unit_price: 29.99 }, forecast_date: '2026-02-25', predicted_qty: 42, confidence: 0.92, risk_level: 'HIGH', created_at: '' },
            { id: 2, product_id: 3, Product: { id: 3, name: 'USB-C Hub 7-in-1', sku: 'SKU-042', category: 'Electronics', vendor_id: 3, reorder_level: 20, current_stock: 2, unit_price: 49.99 }, forecast_date: '2026-02-25', predicted_qty: 85, confidence: 0.88, risk_level: 'CRITICAL', created_at: '' },
            { id: 3, product_id: 4, Product: { id: 4, name: 'Wireless Keyboard', sku: 'SKU-087', category: 'Electronics', vendor_id: 3, reorder_level: 25, current_stock: 8, unit_price: 79.99 }, forecast_date: '2026-02-25', predicted_qty: 30, confidence: 0.79, risk_level: 'MEDIUM', created_at: '' },
            { id: 4, product_id: 6, Product: { id: 6, name: 'A4 Paper 500pk', sku: 'SKU-120', category: 'Supplies', vendor_id: 3, reorder_level: 50, current_stock: 200, unit_price: 12.99 }, forecast_date: '2026-02-25', predicted_qty: 45, confidence: 0.95, risk_level: 'LOW', created_at: '' },
        ] as any[];
    }
}