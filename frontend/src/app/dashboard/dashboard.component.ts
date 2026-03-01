import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { AnalyticsSummary, Alert, PurchaseOrder, Product } from '../shared/models/interfaces';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, BaseChartDirective],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

    summary: AnalyticsSummary = { totalProducts: 0, lowStockItems: 0, outOfStockItems: 0, pendingOrders: 0 };
    recentAlerts: Alert[] = [];
    recentOrders: PurchaseOrder[] = [];
    lowStockItems: Product[] = [];
    loading = true;


    trendData: ChartConfiguration<'line'>['data'] = {
        labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
        datasets: [
            {
                label: 'Stock In',
                data: [4200, 5100, 4800, 6200, 5800, 7100],
                borderColor: '#00b4ff', backgroundColor: 'rgba(0,180,255,0.07)',
                fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4,
                pointBackgroundColor: '#00b4ff'
            },
            {
                label: 'Stock Out',
                data: [3800, 4600, 4200, 5900, 5200, 6400],
                borderColor: '#00ffcc', backgroundColor: 'rgba(0,255,200,0.05)',
                fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4,
                pointBackgroundColor: '#00ffcc'
            }
        ]
    };

    trendOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        plugins: {
            legend: { labels: { color: 'rgba(255,255,255,0.5)', font: { family: 'Rajdhani', size: 12 } } }
        },
        scales: {
            x: { ticks: { color: 'rgba(255,255,255,0.4)' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: 'rgba(255,255,255,0.4)' }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
    };


    pieData: ChartConfiguration<'doughnut'>['data'] = {
        labels: ['Electronics', 'Furniture', 'Supplies', 'Perishables', 'Other'],
        datasets: [{
            data: [35, 20, 25, 12, 8],
            backgroundColor: ['#00b4ff', '#00ffcc', '#ffaa00', '#ff4d6d', '#a855f7'],
            borderWidth: 0, hoverOffset: 8
        }]
    };

    pieOptions: ChartConfiguration<'doughnut'>['options'] = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: 'rgba(255,255,255,0.5)', font: { family: 'Rajdhani', size: 12 }, padding: 14, boxWidth: 12 }
            }
        }
    };

    constructor(private api: ApiService) { }

    ngOnInit() { this.loadData(); }

    loadData() {
        this.loading = true;

        this.api.getAnalyticsSummary().subscribe({
            next: s => this.summary = s,
            error: () => { }
        });

        this.api.getAlerts({ is_read: false, limit: 5 }).subscribe({
            next: res => this.recentAlerts = res.data,
            error: () => { }
        });

        this.api.getOrders({ status: 'PENDING', limit: 5 }).subscribe({
            next: res => { this.recentOrders = res.data; this.loading = false; },
            error: () => { this.loading = false; }
        });

        this.api.getProducts({ status: 'low', limit: 6 }).subscribe({
            next: res => this.lowStockItems = res.data,
            error: () => { }
        });
    }

    getStatusClass(stock: number, reorder: number): string {
        if (stock === 0) return 'out';
        if (stock <= reorder) return stock <= reorder / 2 ? 'crit' : 'low';
        return 'ok';
    }

    getStatusLabel(stock: number, reorder: number): string {
        if (stock === 0) return 'Out of Stock';
        if (stock <= reorder / 2) return 'Critical';
        if (stock <= reorder) return 'Low Stock';
        return 'In Stock';
    }
}