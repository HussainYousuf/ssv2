export namespace Shopify {

    export type Variant = {
        id: any;
        product_id: any;
        title: string;
        price: string;
        sku: string;
        position: number;
        inventory_policy: string;
        compare_at_price: string;
        fulfillment_service: string;
        inventory_management: string;
        option1: string;
        option2: string;
        option3?: any;
        created_at: Date;
        updated_at: Date;
        taxable: boolean;
        barcode?: any;
        grams: number;
        image_id?: any;
        weight: number;
        weight_unit: string;
        inventory_item_id: any;
        inventory_quantity: number;
        old_inventory_quantity: number;
        requires_shipping: boolean;
        admin_graphql_api_id: string;
    };

    export type Option = {
        id: any;
        product_id: any;
        name: string;
        position: number;
        values: string[];
    };

    export type Image = {
        id: any;
        product_id: any;
        position: number;
        created_at: Date;
        updated_at: Date;
        alt?: any;
        width: number;
        height: number;
        src: string;
        variant_ids: any[];
        admin_graphql_api_id: string;
    };

    export type Image2 = {
        id: any;
        product_id: any;
        position: number;
        created_at: Date;
        updated_at: Date;
        alt?: any;
        width: number;
        height: number;
        src: string;
        variant_ids: any[];
        admin_graphql_api_id: string;
    };

    export type Product = {
        id: any;
        title: string;
        body_html: string;
        vendor: string;
        product_type: string;
        created_at: Date;
        handle: string;
        updated_at: Date;
        published_at?: Date;
        template_suffix: string;
        status: string;
        published_scope: string;
        tags: string;
        admin_graphql_api_id: string;
        variants: Variant[];
        options: Option[];
        images: Image[];
        image: Image2;
    };

    export type Products = {
        products: Product[];
    };

    export type SingleProduct = {
        product: Product;
    };

    export type SingleVariant = {
        variant: Variant;
    };

    export type SingleCustomer = {
        customer: Customer;
    };

    export type Customers = {
        customers: Customer[];
    };

    export type Customer = {
        id: number;
        email?: string;
        accepts_marketing: boolean;
        created_at: string;
        updated_at: string;
        first_name: string;
        last_name: string;
        orders_count: number;
        state: string;
        total_spent: string;
        last_order_id?: number;
        note: any;
        verified_email: boolean;
        multipass_identifier: any;
        tax_exempt: boolean;
        phone?: string;
        tags: string;
        last_order_name?: string;
        currency: string;
        addresses: Address[];
        accepts_marketing_updated_at: string;
        marketing_opt_in_level: any;
        tax_exemptions: any[];
        admin_graphql_api_id: string;
        default_address?: DefaultAddress;
    };

    export type Address = {
        id: number;
        customer_id: number;
        first_name: string;
        last_name: string;
        company: any;
        address1: string;
        address2: any;
        city: string;
        province: string;
        country: string;
        zip: string;
        phone: string;
        name: string;
        province_code?: string;
        country_code: string;
        country_name: string;
        default: boolean;
    };

    export type DefaultAddress = {
        id: number;
        customer_id: number;
        first_name: string;
        last_name: string;
        company: any;
        address1: string;
        address2: any;
        city: string;
        province: string;
        country: string;
        zip: string;
        phone: string;
        name: string;
        province_code?: string;
        country_code: string;
        country_name: string;
        default: boolean;
    };

}

