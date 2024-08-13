import "jest-extended";

import { AttributeMap } from "@packages/core-kernel/src/services/attributes/attribute-map";
import { AttributeSet } from "@packages/core-kernel/src/services/attributes/attribute-set";

describe("AttributeMap", () => {
    it("should get all attribute", () => {
        const set: AttributeSet = new AttributeSet();
        set.set("someAttribute");

        const map: AttributeMap = new AttributeMap(set);
        map.set("someAttribute", "value");

        expect(map.all()).toEqual({ someAttribute: "value" });
    });

    it("should get the given attribute", () => {
        const set: AttributeSet = new AttributeSet();
        set.set("someAttribute");

        const map: AttributeMap = new AttributeMap(set);
        map.set("someAttribute", "value");

        expect(map.get("someAttribute")).toBe("value");
    });

    it("should set nested attributes", () => {
        const set: AttributeSet = new AttributeSet();
        set.set("collection");
        set.set("collection.key1");
        set.set("collection.key2");
        set.set("collection.key3");

        const map: AttributeMap = new AttributeMap(set);
        map.set("collection", {});
        map.set("collection.key1", "value1");
        map.set("collection.key2", "value2");
        map.set("collection.key3", "value3");

        expect(map.get("collection")).toEqual({
            key1: "value1",
            key2: "value2",
            key3: "value3",
        });
        expect(map.get("collection.key1")).toBe("value1");
        expect(map.get("collection.key2")).toBe("value2");
        expect(map.get("collection.key3")).toBe("value3");
    });

    it("should forget the given attribute", () => {
        const set: AttributeSet = new AttributeSet();
        set.set("someAttribute");

        const map: AttributeMap = new AttributeMap(set);
        map.set("someAttribute", "value");

        expect(map.has("someAttribute")).toBeTrue();

        map.forget("someAttribute");

        expect(map.has("someAttribute")).toBeFalse();
    });

    it("should forget all attributes", () => {
        const set: AttributeSet = new AttributeSet();
        set.set("someAttribute");

        const map: AttributeMap = new AttributeMap(set);
        expect(map.has("someAttribute")).toBeFalse();

        map.set("someAttribute", "value");

        expect(map.has("someAttribute")).toBeTrue();

        map.flush();

        expect(map.has("someAttribute")).toBeFalse();
    });

    it("should throw if an unknown attribute is tried to be retrieved", () => {
        const map: AttributeMap = new AttributeMap(new AttributeSet());

        expect(() => map.get("someAttribute")).toThrow("Unknown attribute: someAttribute");
    });

    it("should throw if an unknown attribute is tried to be set", () => {
        const map: AttributeMap = new AttributeMap(new AttributeSet());

        expect(() => map.set("someAttribute", "value")).toThrow("Unknown attribute: someAttribute");
    });

    it("should throw if an unknown attribute is tried to be forgotten", () => {
        const map: AttributeMap = new AttributeMap(new AttributeSet());

        expect(() => map.forget("someAttribute")).toThrow("Unknown attribute: someAttribute");
    });

    it("should throw if an unknown attribute is tried to be checked", () => {
        const map: AttributeMap = new AttributeMap(new AttributeSet());

        expect(() => map.has("someAttribute")).toThrow("Unknown attribute: someAttribute");
    });
});
