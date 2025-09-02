function toB(aData) {
    const products = aData.data.shop_product_cards[0].valid_product_cards;
    
    return {
        schema: {
            model: {
                sku_detail: {
                    value: products.map(p => ({
                        id: Math.random().toString(36).substr(2, 9) + '-' + 
                            Math.random().toString(36).substr(2, 4) + '-' + 
                            Math.random().toString(36).substr(2, 4) + '-' + 
                            Math.random().toString(36).substr(2, 4) + '-' + 
                            Math.random().toString(36).substr(2, 12),
                        stock_info: { stock_num: p.stock_info.num },
                        sku_status: true,
                        confirm_no_barcode: false,
                        spec_detail_ids: [
                            p.spec_info[0].value.includes('1瓶') ? '997852115074171730' : '996662214245076355'
                        ],
                        price: (p.price / 100).toFixed(1)
                    }))
                },
                spec_detail: {
                    value: [{
                        id: "10000",
                        name: "套餐类型", 
                        spec_values: [
                            {
                                id: "996662214245076355",
                                name: "【买二加一 大半年用量】270g*3瓶"
                            },
                            {
                                id: "997852115074171730", 
                                name: "【贵在运费】270g*1瓶"
                            }
                        ]
                    }]
                },
                title: { value: products[0].title }
            }
        }
    };
}