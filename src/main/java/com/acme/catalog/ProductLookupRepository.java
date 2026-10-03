package com.acme.catalog;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ProductLookupRepository {
    private static final String ACTIVE_PRODUCTS_BY_CATEGORY =
        "SELECT sku, display_name FROM products WHERE category_code = ? AND active = TRUE ORDER BY sku";

    private final JdbcTemplate jdbcTemplate;

    public ProductLookupRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ProductSummary> findActiveByCategory(String categoryCode) {
        return jdbcTemplate.query(
            ACTIVE_PRODUCTS_BY_CATEGORY,
            (productRow, rowNumber) -> new ProductSummary(
                productRow.getString("sku"), productRow.getString("display_name")),
            categoryCode);
    }

    public record ProductSummary(String sku, String displayName) {}
}
