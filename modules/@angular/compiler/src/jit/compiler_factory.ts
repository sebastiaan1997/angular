/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {COMPILER_OPTIONS, Compiler, CompilerFactory, CompilerOptions, Inject, InjectionToken, Optional, PLATFORM_INITIALIZER, PlatformRef, Provider, ReflectiveInjector, TRANSLATIONS, TRANSLATIONS_FORMAT, Type, ViewEncapsulation, createPlatformFactory, isDevMode, platformCore} from '@angular/core';

import {AnimationParser} from '../animation/animation_parser';
import {CompilerConfig} from '../config';
import {DirectiveNormalizer} from '../directive_normalizer';
import {DirectiveResolver} from '../directive_resolver';
import {DirectiveWrapperCompiler} from '../directive_wrapper_compiler';
import {Lexer} from '../expression_parser/lexer';
import {Parser} from '../expression_parser/parser';
import * as i18n from '../i18n/index';
import {CompilerInjectable} from '../injectable';
import {CompileMetadataResolver} from '../metadata_resolver';
import {HtmlParser} from '../ml_parser/html_parser';
import {NgModuleCompiler} from '../ng_module_compiler';
import {NgModuleResolver} from '../ng_module_resolver';
import {PipeResolver} from '../pipe_resolver';
import {Console, ReflectionCapabilities, Reflector, ReflectorReader, reflector} from '../private_import_core';
import {ResourceLoader} from '../resource_loader';
import {DomElementSchemaRegistry} from '../schema/dom_element_schema_registry';
import {ElementSchemaRegistry} from '../schema/element_schema_registry';
import {StyleCompiler} from '../style_compiler';
import {SummaryResolver} from '../summary_resolver';
import {TemplateParser} from '../template_parser/template_parser';
import {DEFAULT_PACKAGE_URL_PROVIDER, UrlResolver} from '../url_resolver';
import {ViewCompiler} from '../view_compiler/view_compiler';

import {JitCompiler} from './compiler';

const _NO_RESOURCE_LOADER: ResourceLoader = {
  get(url: string): Promise<string>{
      throw new Error(
          `No ResourceLoader implementation has been provided. Can't read the url "${url}"`);}
};

const baseHtmlParser = new InjectionToken('HtmlParser');

/**
 * A set of providers that provide `JitCompiler` and its dependencies to use for
 * template compilation.
 */
export const COMPILER_PROVIDERS: Array<any|Type<any>|{[k: string]: any}|any[]> = [
  {provide: Reflector, useValue: reflector},
  {provide: ReflectorReader, useExisting: Reflector},
  {provide: ResourceLoader, useValue: _NO_RESOURCE_LOADER},
  SummaryResolver,
  Console,
  Lexer,
  Parser,
  {
    provide: baseHtmlParser,
    useClass: HtmlParser,
  },
  {
    provide: i18n.I18NHtmlParser,
    useFactory: (parser: HtmlParser, translations: string, format: string) =>
                    new i18n.I18NHtmlParser(parser, translations, format),
    deps: [
      baseHtmlParser,
      [new Optional(), new Inject(TRANSLATIONS)],
      [new Optional(), new Inject(TRANSLATIONS_FORMAT)],
    ]
  },
  {
    provide: HtmlParser,
    useExisting: i18n.I18NHtmlParser,
  },
  TemplateParser,
  DirectiveNormalizer,
  CompileMetadataResolver,
  DEFAULT_PACKAGE_URL_PROVIDER,
  StyleCompiler,
  ViewCompiler,
  NgModuleCompiler,
  DirectiveWrapperCompiler,
  {provide: CompilerConfig, useValue: new CompilerConfig()},
  JitCompiler,
  {provide: Compiler, useExisting: JitCompiler},
  DomElementSchemaRegistry,
  {provide: ElementSchemaRegistry, useExisting: DomElementSchemaRegistry},
  UrlResolver,
  DirectiveResolver,
  PipeResolver,
  NgModuleResolver,
  AnimationParser
];


@CompilerInjectable()
export class JitCompilerFactory implements CompilerFactory {
  private _defaultOptions: CompilerOptions[];
  constructor(@Inject(COMPILER_OPTIONS) defaultOptions: CompilerOptions[]) {
    this._defaultOptions = [<CompilerOptions>{
                             useDebug: isDevMode(),
                             useJit: true,
                             defaultEncapsulation: ViewEncapsulation.Emulated
                           }].concat(defaultOptions);
  }
  createCompiler(options: CompilerOptions[] = []): Compiler {
    const mergedOptions = _mergeOptions(this._defaultOptions.concat(options));
    const injector = ReflectiveInjector.resolveAndCreate([
      COMPILER_PROVIDERS, {
        provide: CompilerConfig,
        useFactory: () => {
          return new CompilerConfig({
            // let explicit values from the compiler options overwrite options
            // from the app providers. E.g. important for the testing platform.
            genDebugInfo: mergedOptions.useDebug,
            // let explicit values from the compiler options overwrite options
            // from the app providers
            useJit: mergedOptions.useJit,
            // let explicit values from the compiler options overwrite options
            // from the app providers
            defaultEncapsulation: mergedOptions.defaultEncapsulation,
            logBindingUpdate: mergedOptions.useDebug
          });
        },
        deps: []
      },
      mergedOptions.providers
    ]);
    return injector.get(Compiler);
  }
}

function _initReflector() {
  reflector.reflectionCapabilities = new ReflectionCapabilities();
}

/**
 * A platform that included corePlatform and the compiler.
 *
 * @experimental
 */
export const platformCoreDynamic = createPlatformFactory(platformCore, 'coreDynamic', [
  {provide: COMPILER_OPTIONS, useValue: {}, multi: true},
  {provide: CompilerFactory, useClass: JitCompilerFactory},
  {provide: PLATFORM_INITIALIZER, useValue: _initReflector, multi: true},
]);

function _mergeOptions(optionsArr: CompilerOptions[]): CompilerOptions {
  return {
    useDebug: _lastDefined(optionsArr.map(options => options.useDebug)),
    useJit: _lastDefined(optionsArr.map(options => options.useJit)),
    defaultEncapsulation: _lastDefined(optionsArr.map(options => options.defaultEncapsulation)),
    providers: _mergeArrays(optionsArr.map(options => options.providers))
  };
}

function _lastDefined<T>(args: T[]): T {
  for (let i = args.length - 1; i >= 0; i--) {
    if (args[i] !== undefined) {
      return args[i];
    }
  }
  return undefined;
}

function _mergeArrays(parts: any[][]): any[] {
  const result: any[] = [];
  parts.forEach((part) => part && result.push(...part));
  return result;
}
