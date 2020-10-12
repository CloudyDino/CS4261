export class PayrollInfo {
    employeeInfo: EmployeeInfo[];
    totalTaxesToPay: number;
    totalSalaryToPay: number;
    totalMoneyRequired: number;

    constructor() {
        this.employeeInfo = [];
        this.totalTaxesToPay = 0;
        this.totalSalaryToPay = 0;
        this.totalMoneyRequired = 0;
    }
}

export interface EmployeeInfo {
    name: string;
    regularHours: number;
    regularHourlyWage: number;
    grossRegularPay: number;
    overtimeHours: number;
    overtimeHourlyWage: number;
    grossOvertimePay: number;
    grossPay: number;
    federalUnemployment: number;
    federalWitholding: number;
    medicareCompany: number;
    medicareEmployee: number;
    medicareEmployeeAddlTax: number;
    socialSecurtityCompany: number;
    socialSecurtityEmployee: number;
    stateWitholding: number;
    stateUnemployment: number;
    stateAdminAssesment: number;
    totalEmployeeTaxes: number;
    totalCompanyTaxes: number;
    netPay: number;
}