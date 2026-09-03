package io.github.raisybear.yocsow.engine.seed;

public record SeedRange(long minimum, long maximum) {

    public SeedRange {
        if (minimum > maximum) {
            throw new IllegalArgumentException(
                    "minimum must not be greater than maximum"
            );
        }
    }

    public boolean contains(long seed) {
        return seed >= minimum && seed <= maximum;
    }
}
